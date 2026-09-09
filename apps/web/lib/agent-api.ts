import { NextResponse, type NextRequest } from "next/server";
import { isValidAgentToken } from "@jonas/shared";

export function unauthorized() {
  return NextResponse.json({ error: "token inválido" }, { status: 401 });
}

export function requireAgentToken(req: NextRequest): NextResponse | null {
  const token = req.headers.get("x-webhook-token");
  if (!isValidAgentToken(token)) return unauthorized();
  return null;
}

export function decodePhoneParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
