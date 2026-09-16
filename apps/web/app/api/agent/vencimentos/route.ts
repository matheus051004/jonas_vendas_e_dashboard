import { NextResponse, type NextRequest } from "next/server";
import { listActiveDueDates, listAllDueDates } from "@jonas/shared";
import { requireAgentToken } from "@/lib/agent-api";

export async function GET(req: NextRequest) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const showAll = req.nextUrl.searchParams.get("all") === "true";
  const dueDates = showAll ? await listAllDueDates() : await listActiveDueDates();

  return NextResponse.json({
    ok: true,
    dueDates,
  });
}
