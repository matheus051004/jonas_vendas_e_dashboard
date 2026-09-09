import { NextResponse, type NextRequest } from "next/server";
import { findClientByPhone, confirmContractSigned, serializeClientForAgent } from "@jonas/shared";
import { decodePhoneParam, requireAgentToken } from "@/lib/agent-api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const { phone: raw } = await params;
  const phone = decodePhoneParam(raw);
  const client = await findClientByPhone(phone);
  if (!client) {
    return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const observation = typeof body?.observation === "string" ? body.observation : undefined;

  try {
    const updated = await confirmContractSigned(client.id, { observation });
    return NextResponse.json({
      ok: true,
      message: "Assinatura do contrato confirmada com sucesso! O lead foi avançado para FECHOU_VENDA.",
      client: serializeClientForAgent(updated),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao confirmar assinatura do contrato";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
