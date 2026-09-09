import { NextResponse, type NextRequest } from "next/server";
import { listPlansByAreaId } from "@jonas/shared";
import { requireAgentToken } from "@/lib/agent-api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ areaId: string }> }
) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const { areaId } = await params;
  const result = await listPlansByAreaId(areaId);

  if ("error" in result) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "área não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ error: "área inativa" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...result });
}
