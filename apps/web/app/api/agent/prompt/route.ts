import { NextResponse, type NextRequest } from "next/server";
import { getAiPrompt } from "@jonas/shared";
import { requireAgentToken } from "@/lib/agent-api";

export async function GET(req: NextRequest) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const prompt = await getAiPrompt();
  return NextResponse.json({ ok: true, prompt });
}
