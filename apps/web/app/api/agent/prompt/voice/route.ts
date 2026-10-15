import { NextResponse, type NextRequest } from "next/server";
import { getVoiceAiPrompt } from "@jonas/shared";
import { requireAgentToken } from "@/lib/agent-api";

export async function GET(req: NextRequest) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const prompt = await getVoiceAiPrompt();
  return NextResponse.json({ ok: true, prompt, type: "voice" });
}
