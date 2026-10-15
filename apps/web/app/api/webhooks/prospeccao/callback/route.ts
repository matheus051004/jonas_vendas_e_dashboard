import { NextResponse, type NextRequest } from "next/server";
import {
  ProspectingCallbackSchema,
  publishCallResult,
  normalizePhone,
  isValidAgentToken,
} from "@jonas/shared";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-webhook-token");
  if (!isValidAgentToken(token)) {
    return NextResponse.json({ error: "token inválido ou ausente" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ProspectingCallbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { phone, answered } = parsed.data;
  const normalized = normalizePhone(phone);

  await publishCallResult(normalized, answered);

  return NextResponse.json({
    ok: true,
    phone: normalized,
    answered,
  });
}
