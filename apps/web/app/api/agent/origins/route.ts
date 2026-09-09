import { NextResponse, type NextRequest } from "next/server";
import { listActiveOrigins } from "@jonas/shared";
import { requireAgentToken } from "@/lib/agent-api";

export async function GET(req: NextRequest) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const origins = await listActiveOrigins();
  return NextResponse.json({ ok: true, origins });
}
