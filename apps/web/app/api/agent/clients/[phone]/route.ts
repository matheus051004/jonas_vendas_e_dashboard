import { NextResponse, type NextRequest } from "next/server";
import {
  UpdateClientBodySchema,
  findClientByPhone,
  serializeClientForAgent,
  updateClientFields,
} from "@jonas/shared";
import { decodePhoneParam, requireAgentToken } from "@/lib/agent-api";

export async function GET(
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

  return NextResponse.json({
    ok: true,
    client: {
      ...serializeClientForAgent(client),
      area: client.area,
      origin: client.origin,
      contract: client.contract
        ? {
            id: client.contract.id,
            planId: client.contract.planId,
            fullName: client.contract.fullName,
            createdAt: client.contract.createdAt.toISOString(),
          }
        : null,
    },
  });
}

export async function PATCH(
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
  const parsed = UpdateClientBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateClientFields(client.id, parsed.data);
    return NextResponse.json({ ok: true, client: serializeClientForAgent(updated) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar dados do lead";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
