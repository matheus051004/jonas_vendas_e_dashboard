import { createHmac } from "node:crypto";
import { getSettings } from "./settings";
import type {
  AgentWebhookPayload,
  ContractWebhookPayload,
  OutboundMessagePayload,
} from "./types";

async function postJson(url: string, secret: string | null | undefined, body: unknown) {
  if (!url) return;

  const payload = JSON.stringify(body);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["x-webhook-signature"] = createHmac("sha256", secret).update(payload).digest("hex");

  const res = await fetch(url, { method: "POST", headers, body: payload });
  if (!res.ok) throw new Error(`Webhook ${url} respondeu ${res.status}`);
}

export async function sendOutboundMessage(payload: OutboundMessagePayload) {
  const settings = await getSettings();
  await postJson(settings.outboundWebhookUrl, settings.outboundWebhookSecret, payload);
}

export async function sendContractWebhook(payload: ContractWebhookPayload) {
  const settings = await getSettings();
  await postJson(settings.contractWebhookUrl, settings.outboundWebhookSecret, payload);
}

/**
 * Notifica o sistema de IA externo (agentWebhookUrl).
 * Se a URL estiver vazia, lança erro para o job retryar e o operador perceber a config.
 */
export async function sendAgentWebhook(payload: AgentWebhookPayload) {
  const settings = await getSettings();
  if (!settings.agentWebhookUrl) {
    throw new Error(
      "agentWebhookUrl não configurado em Settings — configure a URL do sistema de IA externo"
    );
  }
  await postJson(settings.agentWebhookUrl, settings.outboundWebhookSecret, payload);
}
