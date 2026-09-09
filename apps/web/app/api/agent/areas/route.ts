import { NextResponse, type NextRequest } from "next/server";
import { listActiveAreas } from "@jonas/shared";
import { requireAgentToken } from "@/lib/agent-api";

export async function GET(req: NextRequest) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const areas = await listActiveAreas();
  return NextResponse.json({ ok: true, areas });
}
