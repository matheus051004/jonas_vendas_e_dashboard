import { randomUUID } from "node:crypto";
import type { Settings } from "@jonas/db";
import { addSystemLog } from "./logger";
import { redisConnection } from "./queue";
import { getSettings, updateSettings } from "./settings";

export const DEFAULT_HUBSOFT_BASE_URL = "https://api.ligtop.hubsoft.com.br";
export const HUBSOFT_RENEW_INTERVAL_DAYS = 29;
const HUBSOFT_RENEW_INTERVAL_MS = HUBSOFT_RENEW_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const HUBSOFT_PROACTIVE_EXPIRY_BUFFER_MS = 24 * 60 * 60 * 1000;
const HUBSOFT_HOTPATH_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const HUBSOFT_OAUTH_TIMEOUT_MS = 30_000;
const HUBSOFT_LOCK_KEY = "hubsoft:oauth:lock";
const HUBSOFT_LOCK_TTL_MS = 35_000;

let inFlightTokenPromise: Promise<HubsoftTokenResult> | null = null;

export interface HubsoftOAuthConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export interface HubsoftTokenResult {
  accessToken: string;
  refreshToken: string;
  updatedAt: Date;
  expiresAt: Date | null;
}

interface HubsoftOAuthResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
  message?: unknown;
  msg?: unknown;
}

function normalizeBaseUrl(raw?: string | null): string {
  const trimmed = (raw ?? "").trim();
  const base = trimmed || DEFAULT_HUBSOFT_BASE_URL;
  return base.replace(/\/+$/, "");
}

export function resolveHubsoftOAuthConfig(settings: Settings): HubsoftOAuthConfig {
  return {
    baseUrl: normalizeBaseUrl(settings.hubsoftBaseUrl || process.env.HUBSOFT_BASE_URL),
    clientId: (settings.hubsoftClientId || process.env.HUBSOFT_CLIENT_ID || "").trim(),
    clientSecret: (settings.hubsoftClientSecret || process.env.HUBSOFT_CLIENT_SECRET || "").trim(),
    username: (settings.hubsoftUsername || process.env.HUBSOFT_USERNAME || "").trim(),
    password: (settings.hubsoftPassword || process.env.HUBSOFT_PASSWORD || "").trim(),
  };
}

export function hasHubsoftOAuthCredentials(config: HubsoftOAuthConfig): boolean {
  return Boolean(config.clientId && config.clientSecret && config.username && config.password);
}

function parseExpiresInSeconds(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function extractOAuthErrorDetail(data: HubsoftOAuthResponse | null, status: number): string {
  const candidate =
    (typeof data?.error_description === "string" && data.error_description.trim()) ||
    (typeof data?.message === "string" && data.message.trim()) ||
    (typeof data?.msg === "string" && data.msg.trim()) ||
    (typeof data?.error === "string" && data.error.trim()) ||
    "";
  return candidate
    ? `Falha ao autenticar no Hubsoft (HTTP ${status}): ${candidate}`
    : `Falha ao autenticar no Hubsoft (HTTP ${status})`;
}

async function releaseRedisLock(lockToken: string): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0
  `;
  await redisConnection.eval(script, 1, HUBSOFT_LOCK_KEY, lockToken).catch(() => {});
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeLockedTokenRequest(
  checkAlreadyFresh?: (settings: Settings) => boolean
): Promise<HubsoftTokenResult> {
  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    const beforeSettings = await getSettings({ bypassCache: true });
    const initialUpdatedAtMs = beforeSettings.hubsoftTokenUpdatedAt?.getTime() ?? 0;

    const lockToken = randomUUID();
    let acquired = await redisConnection
      .set(HUBSOFT_LOCK_KEY, lockToken, "PX", HUBSOFT_LOCK_TTL_MS, "NX")
      .catch(() => null);

    if (acquired !== "OK") {
      // Outro processo (web ou worker) já está renovando: aguarda até o lock expirar ou ser liberado.
      const deadline = Date.now() + HUBSOFT_LOCK_TTL_MS;
      while (Date.now() < deadline) {
        await sleep(300);
        const latest = await getSettings({ bypassCache: true });
        const latestUpdatedAtMs = latest.hubsoftTokenUpdatedAt?.getTime() ?? 0;
        const wasUpdatedByLockHolder = latestUpdatedAtMs > initialUpdatedAtMs;

        if (
          latest.hubsoftAccessToken.trim() &&
          (wasUpdatedByLockHolder || (checkAlreadyFresh !== undefined && checkAlreadyFresh(latest)))
        ) {
          return {
            accessToken: latest.hubsoftAccessToken.trim(),
            refreshToken: latest.hubsoftRefreshToken.trim(),
            updatedAt: latest.hubsoftTokenUpdatedAt ?? new Date(),
            expiresAt: latest.hubsoftTokenExpiresAt ?? null,
          };
        }

        acquired = await redisConnection
          .set(HUBSOFT_LOCK_KEY, lockToken, "PX", HUBSOFT_LOCK_TTL_MS, "NX")
          .catch(() => null);
        if (acquired === "OK") break;
      }
    }

    try {
      const latest = await getSettings({ bypassCache: true });
      const latestUpdatedAtMs = latest.hubsoftTokenUpdatedAt?.getTime() ?? 0;
      const wasUpdatedByLockHolder = latestUpdatedAtMs > initialUpdatedAtMs;
      if (
        latest.hubsoftAccessToken.trim() &&
        (wasUpdatedByLockHolder || (checkAlreadyFresh !== undefined && checkAlreadyFresh(latest)))
      ) {
        return {
          accessToken: latest.hubsoftAccessToken.trim(),
          refreshToken: latest.hubsoftRefreshToken.trim(),
          updatedAt: latest.hubsoftTokenUpdatedAt ?? new Date(),
          expiresAt: latest.hubsoftTokenExpiresAt ?? null,
        };
      }

      return await fetchAndPersistHubsoftToken(latest);
    } finally {
      if (acquired === "OK") {
        await releaseRedisLock(lockToken);
      }
    }
  })();

  try {
    return await inFlightTokenPromise;
  } finally {
    inFlightTokenPromise = null;
  }
}

async function fetchAndPersistHubsoftToken(settings: Settings): Promise<HubsoftTokenResult> {
  const config = resolveHubsoftOAuthConfig(settings);
  if (!hasHubsoftOAuthCredentials(config)) {
    throw new Error(
      "Credenciais OAuth do Hubsoft não configuradas (client_id, client_secret, username, password). Configure em Configurações → Follow-up & Hubsoft."
    );
  }

  const tokenUrl = `${config.baseUrl}/oauth/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      username: config.username,
      password: config.password,
      grant_type: "password",
    }),
    signal: AbortSignal.timeout(HUBSOFT_OAUTH_TIMEOUT_MS),
  });

  const data = (await res.json().catch(() => null)) as HubsoftOAuthResponse | null;
  if (!res.ok) {
    const detail = extractOAuthErrorDetail(data, res.status);
    await addSystemLog({
      level: "error",
      source: "hubsoft-oauth",
      message: detail,
      details: data,
    });
    throw new Error(detail);
  }

  const accessToken = typeof data?.access_token === "string" ? data.access_token.trim() : "";
  if (!accessToken) {
    const detail = "Hubsoft /oauth/token não retornou access_token válido.";
    await addSystemLog({
      level: "error",
      source: "hubsoft-oauth",
      message: detail,
      details: data,
    });
    throw new Error(detail);
  }

  const refreshToken = typeof data?.refresh_token === "string" ? data.refresh_token.trim() : "";
  const expiresInSecs = parseExpiresInSeconds(data?.expires_in);
  const updatedAt = new Date();
  const expiresAt = expiresInSecs ? new Date(updatedAt.getTime() + expiresInSecs * 1000) : null;

  await updateSettings({
    hubsoftAccessToken: accessToken,
    hubsoftRefreshToken: refreshToken,
    hubsoftTokenUpdatedAt: updatedAt,
    hubsoftTokenExpiresAt: expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    updatedAt,
    expiresAt,
  };
}

function isTokenUsable(settings: Settings, bufferMs: number): boolean {
  if (!settings.hubsoftAccessToken.trim()) return false;
  const nowMs = Date.now();
  if (settings.hubsoftTokenExpiresAt && settings.hubsoftTokenExpiresAt.getTime() - bufferMs <= nowMs) {
    return false;
  }
  if (
    settings.hubsoftTokenUpdatedAt &&
    nowMs - settings.hubsoftTokenUpdatedAt.getTime() >= HUBSOFT_RENEW_INTERVAL_MS
  ) {
    return false;
  }
  return true;
}

/**
 * Gera e persiste imediatamente um novo par access_token / refresh_token no Hubsoft.
 */
export async function requestNewHubsoftToken(): Promise<HubsoftTokenResult> {
  return executeLockedTokenRequest();
}

/**
 * Retorna um access_token válido para uso imediato nas chamadas à API do Hubsoft,
 * gerando ou renovando automaticamente via OAuth caso ainda não exista ou tenha vencido.
 */
export async function getValidHubsoftAccessToken(): Promise<string> {
  const settings = await getSettings();
  if (isTokenUsable(settings, HUBSOFT_HOTPATH_EXPIRY_BUFFER_MS)) {
    return settings.hubsoftAccessToken.trim();
  }

  const result = await executeLockedTokenRequest((latest) =>
    isTokenUsable(latest, HUBSOFT_HOTPATH_EXPIRY_BUFFER_MS)
  );
  return result.accessToken;
}

/**
 * Força renovação após uma resposta HTTP 401 do Hubsoft (evitando corrida se outro processo já renovou).
 */
export async function refreshHubsoftTokenAfterUnauthorized(failedToken: string): Promise<string> {
  const result = await executeLockedTokenRequest((latest) => {
    const current = latest.hubsoftAccessToken.trim();
    return Boolean(current) && current !== failedToken.trim();
  });
  return result.accessToken;
}

/**
 * Verifica periodicamente (janela de 29 dias / expiração próxima) e renova o token em background.
 */
export async function renewHubsoftTokenIfDue(): Promise<{
  renewed: boolean;
  reason: "ok_fresh" | "credentials_not_configured" | "renewed";
  updatedAt?: Date;
  expiresAt?: Date | null;
}> {
  const settings = await getSettings({ bypassCache: true });
  const config = resolveHubsoftOAuthConfig(settings);
  if (!hasHubsoftOAuthCredentials(config)) {
    return { renewed: false, reason: "credentials_not_configured" };
  }

  const needsRenewal =
    !settings.hubsoftTokenUpdatedAt ||
    !isTokenUsable(settings, HUBSOFT_PROACTIVE_EXPIRY_BUFFER_MS);

  if (!needsRenewal) {
    return {
      renewed: false,
      reason: "ok_fresh",
      updatedAt: settings.hubsoftTokenUpdatedAt ?? undefined,
      expiresAt: settings.hubsoftTokenExpiresAt,
    };
  }

  const result = await requestNewHubsoftToken();
  await addSystemLog({
    level: "info",
    source: "hubsoft-oauth",
    message: "Token OAuth do Hubsoft gerado/renovado automaticamente.",
    details: {
      updatedAt: result.updatedAt.toISOString(),
      expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
    },
  });

  return {
    renewed: true,
    reason: "renewed",
    updatedAt: result.updatedAt,
    expiresAt: result.expiresAt,
  };
}
