import { NextResponse, type NextRequest } from "next/server";
import { pauseFollowUp } from "@jonas/shared";
import { decodePhoneParam, requireAgentToken } from "@/lib/agent-api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const { phone: raw } = await params;
  const phone = decodePhoneParam(raw);

  try {
    const result = await pauseFollowUp(phone);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao pausar follow-up";
    const status = message.includes("não encontrado") ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
