import { NextResponse, type NextRequest } from "next/server";
import {
  ElevenLabsWebhookEventSchema,
  getSettings,
  processElevenLabsWebhookEvent,
  verifyElevenLabsWebhookSignature,
} from "@jonas/shared";

const SUPPORTED_EVENT_TYPES = new Set([
  "post_call_transcription",
  "call_initiation_failure",
]);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const settings = await getSettings();
  const secret = (
    settings.elevenLabsWebhookSecret ||
    process.env.ELEVENLABS_WEBHOOK_SECRET ||
    ""
  ).trim();

  const signatureHeader = req.headers.get("elevenlabs-signature");
  if (!verifyElevenLabsWebhookSignature(rawBody, signatureHeader, secret)) {
    return NextResponse.json(
      { error: "Assinatura ElevenLabs inválida ou secret não configurado" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const eventType =
    body && typeof body === "object" && "type" in body
      ? String((body as { type: unknown }).type)
      : "";

  if (!SUPPORTED_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: true, type: eventType || null });
  }

  const parsed = ElevenLabsWebhookEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await processElevenLabsWebhookEvent(parsed.data);
  return NextResponse.json({ ok: true, ...result });
}
