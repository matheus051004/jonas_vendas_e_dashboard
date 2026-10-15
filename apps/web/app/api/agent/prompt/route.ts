import { NextResponse, type NextRequest } from "next/server";
import { getAiPrompt, getVoiceAiPrompt, getTextAiPrompt } from "@jonas/shared";
import { requireAgentToken } from "@/lib/agent-api";

export async function GET(req: NextRequest) {
  const authError = requireAgentToken(req);
  if (authError) return authError;

  const type = req.nextUrl.searchParams.get("type")?.toLowerCase();

  if (type === "voice") {
    const prompt = await getVoiceAiPrompt();
    return NextResponse.json({ ok: true, prompt, type: "voice" });
  }

  if (type === "text") {
    const prompt = await getTextAiPrompt();
    return NextResponse.json({ ok: true, prompt, type: "text" });
  }

  const [prompt, voicePrompt, textPrompt] = await Promise.all([
    getAiPrompt(),
    getVoiceAiPrompt(),
    getTextAiPrompt(),
  ]);

  return NextResponse.json({
    ok: true,
    prompt,
    salesPrompt: prompt,
    voicePrompt,
    textPrompt,
  });
}
