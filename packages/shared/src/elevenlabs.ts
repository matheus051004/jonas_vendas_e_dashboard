import { createHmac, timingSafeEqual } from "node:crypto";
import type { ProspectLead } from "@jonas/db";
import { getSettings } from "./settings";
import { normalizePhone } from "./prospect-services";

const ELEVENLABS_SIP_OUTBOUND_URL = "https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call";

export interface ElevenLabsOutboundCallResult {
  conversationId: string | null;
  sipCallId: string | null;
  message: string;
}

/**
 * Converte telefone brasileiro normalizado (ou bruto) para formato E.164 com '+'.
 * Ex.: "5561991640073" -> "+5561991640073"
 */
export function formatE164Phone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10 || normalized.length > 15) {
    throw new Error("Telefone do lead inválido para chamada SIP.");
  }
  return `+${normalized}`;
}

export const LEAD_DYNAMIC_VARIABLE_KEYS = [
  "lead_id",
  "client_id",
  "phone",
  "name",
  "raw_document",
  "email",
  "secondary_phone",
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
  "cep",
  "full_address",
] as const;

export type LeadDynamicVariableKey = (typeof LEAD_DYNAMIC_VARIABLE_KEYS)[number];

/**
 * Monta as dynamic_variables enviadas na inicialização da chamada ElevenLabs.
 */
export function buildLeadDynamicVariables(
  lead: ProspectLead,
  clientId: string
): Record<LeadDynamicVariableKey, string> {
  const streetAndNumber = [lead.street, lead.number].filter(Boolean).join(", ");
  const fullAddress = [
    streetAndNumber,
    lead.complement,
    lead.neighborhood,
    [lead.city, lead.state].filter(Boolean).join(" - "),
    lead.cep ? `CEP ${lead.cep}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    lead_id: lead.id,
    client_id: clientId,
    phone: lead.phone,
    name: lead.name,
    raw_document: lead.rawDocument ?? "",
    email: lead.email ?? "",
    secondary_phone: lead.secondaryPhone ?? "",
    street: lead.street ?? "",
    number: lead.number ?? "",
    complement: lead.complement ?? "",
    neighborhood: lead.neighborhood ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    cep: lead.cep ?? "",
    full_address: fullAddress,
  };
}

/**
 * Dispara uma chamada de saída via SIP Trunk na ElevenLabs Agents API.
 */
export async function startElevenLabsSipOutboundCall(
  lead: ProspectLead,
  clientId: string
): Promise<ElevenLabsOutboundCallResult> {
  const settings = await getSettings({ bypassCache: true });
  const apiKey = (settings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY || "").trim();
  const agentId = settings.elevenLabsAgentId.trim();
  const phoneNumberId = settings.elevenLabsPhoneNumberId.trim();

  if (!apiKey) {
    throw new Error(
      "API Key da ElevenLabs não configurada em Settings (ou ELEVENLABS_API_KEY)."
    );
  }
  if (!agentId) {
    throw new Error("Agent ID da ElevenLabs não configurado em Settings.");
  }
  if (!phoneNumberId) {
    throw new Error("Phone Number ID (SIP Trunk) da ElevenLabs não configurado em Settings.");
  }

  const toNumber = formatE164Phone(lead.phone);
  const voicePrompt = settings.voiceAiPrompt.trim();
  const firstMessage = settings.voiceFirstMessage.trim();

  const agentOverride: Record<string, unknown> = {};
  if (voicePrompt) {
    agentOverride.prompt = { prompt: voicePrompt };
  }
  if (firstMessage) {
    agentOverride.first_message = firstMessage;
  }

  const initiationClientData: Record<string, unknown> = {
    dynamic_variables: buildLeadDynamicVariables(lead, clientId),
  };
  if (Object.keys(agentOverride).length > 0) {
    initiationClientData.conversation_config_override = {
      agent: agentOverride,
    };
  }

  const res = await fetch(ELEVENLABS_SIP_OUTBOUND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: toNumber,
      conversation_initiation_client_data: initiationClientData,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const rawText = await res.text();
  let parsed: {
    success?: boolean;
    message?: string;
    detail?: unknown;
    conversation_id?: string | null;
    sip_call_id?: string | null;
  } | null = null;

  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok || parsed?.success === false) {
    const detail =
      parsed?.message ??
      (typeof parsed?.detail === "string"
        ? parsed.detail
        : parsed?.detail
          ? JSON.stringify(parsed.detail)
          : rawText) ??
      `HTTP ${res.status}`;
    throw new Error(`ElevenLabs SIP outbound falhou (${res.status}): ${detail}`);
  }

  return {
    conversationId: parsed?.conversation_id ?? null,
    sipCallId: parsed?.sip_call_id ?? null,
    message: parsed?.message ?? "Chamada SIP iniciada",
  };
}

/**
 * Valida o header `ElevenLabs-Signature` (`t=<unix>,v0=<hmac_hex>`) contra o corpo bruto.
 */
export function verifyElevenLabsWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300
): boolean {
  const trimmedSecret = secret.trim();
  if (!trimmedSecret || !signatureHeader) return false;

  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signaturePart = parts.find((p) => p.startsWith("v0="))?.slice(3);

  if (!timestampPart || !signaturePart) return false;
  if (!/^\d+$/.test(timestampPart) || !/^[0-9a-f]{64}$/i.test(signaturePart)) return false;

  const timestampSec = Number.parseInt(timestampPart, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${timestampPart}.${rawBody}`;
  const expectedHex = createHmac("sha256", trimmedSecret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const receivedBuf = Buffer.from(signaturePart.toLowerCase(), "hex");
  const expectedBuf = Buffer.from(expectedHex.toLowerCase(), "hex");

  if (receivedBuf.length === 0 || receivedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(receivedBuf, expectedBuf);
}
