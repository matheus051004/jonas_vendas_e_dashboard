import { NextResponse, type NextRequest } from "next/server";
import {
  RegisterContractPJBodySchema,
  findClientByPhone,
  registerClientContractPJ,
  addSystemLog,
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
  const parsed = RegisterContractPJBodySchema.safeParse(body);
  if (!parsed.success) {
    const errorDetails = parsed.error.flatten();
    await addSystemLog({
      level: "warn",
      source: "contract-pj",
      message: "Dados de contrato PJ inválidos enviados pela IA",
      phone,
      payload: body,
      details: errorDetails,
    });
    return NextResponse.json({ ok: false, error: errorDetails }, { status: 400 });
  }

  try {
    await registerClientContractPJ(client.id, parsed.data);

    return NextResponse.json({
      ok: true,
      message: "Contrato gerado com sucesso! Ele será enviado ao cliente em poucos instantes.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao registrar contrato PJ no Hubsoft";
    const details = (err as { details?: unknown })?.details;

    await addSystemLog({
      level: "error",
      source: "contract-pj",
      message: `Falha ao gerar contrato PJ: ${message}`,
      phone,
      payload: body,
      details,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        ...(details ? { details } : {}),
      },
      { status: 400 }
    );
  }
}
