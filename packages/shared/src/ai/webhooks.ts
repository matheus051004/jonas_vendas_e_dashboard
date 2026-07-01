import { createHmac } from "node:crypto";
import { getSettings } from "../settings";
import type { ContractWebhookPayload, OutboundMessagePayload } from "../types";

async function postJson(url: string, secret: string | null | undefined, body: unknown) {
  if (!url) return; // sem URL configurada no painel, apenas não envia.

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
