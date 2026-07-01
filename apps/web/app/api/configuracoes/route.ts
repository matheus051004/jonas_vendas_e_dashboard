import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings } from "@jonas/shared";

const SettingsUpdateSchema = z.object({
  aiModel: z.string().min(1).optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  openAiApiKey: z.string().optional(),
  generalPrompt: z.string().optional(),
  keyPoints: z.string().optional(),
  toolsDescription: z.string().optional(),
  outboundWebhookUrl: z.string().optional(),
  contractWebhookUrl: z.string().optional(),
  outboundWebhookSecret: z.string().optional(),
});

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = SettingsUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const settings = await updateSettings(parsed.data);
  return NextResponse.json(settings);
}
