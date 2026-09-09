import { NextResponse, type NextRequest } from "next/server";
import {
  SetStageBodySchema,
  findClientByPhone,
  serializeClientForAgent,
  setClientStage,
} from "@jonas/shared";
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

  const body = await req.json().catch(() => null);
  const parsed = SetStageBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await setClientStage(client.id, parsed.data.stage);
    return NextResponse.json({ ok: true, client: serializeClientForAgent(updated) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao alterar etapa";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
