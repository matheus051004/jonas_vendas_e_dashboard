import { NextResponse, type NextRequest } from "next/server";
import {
  AgentReplySchema,
  asWebhookMetadata,
  findClientByPhone,
  saveMessage,
  sendOutboundMessage,
} from "@jonas/shared";
import { requireAgentToken } from "@/lib/agent-api";

/**
 * IA externa envia a resposta ao lead.
 * Salva Message assistant e repassa ao outboundWebhookUrl (app de chat).
 */
export async function POST(req: NextRequest) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  const parsed = AgentReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { phone, text, metadata } = parsed.data;
  const client = await findClientByPhone(phone);
  if (!client) {
    return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });
  }

  await saveMessage(client.id, "assistant", text);

  const replyMetadata = metadata ?? asWebhookMetadata(client.metadata);
  try {
    await sendOutboundMessage({
      phone,
      text,
      ...(replyMetadata ? { metadata: replyMetadata } : {}),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[agent/reply] Falha ao despachar mensagem para outboundWebhookUrl:", errorMsg);
    return NextResponse.json(
      {
        ok: false,
        messageSaved: true,
        clientId: client.id,
        error: `Mensagem salva no chat interno, mas falhou ao repassar para o WhatsApp (outboundWebhookUrl): ${errorMsg}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, clientId: client.id });
}
