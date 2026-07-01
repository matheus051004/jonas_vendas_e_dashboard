import { NextResponse, type NextRequest } from "next/server";
import { InboundWebhookSchema, messagesQueue } from "@jonas/shared";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-webhook-token");
  if (token !== process.env.INBOUND_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = InboundWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Responde rápido; todo o processamento pesado (transcrição, agente, follow-up) roda no worker.
  await messagesQueue.add("incoming", parsed.data);

  return NextResponse.json({ ok: true });
}
