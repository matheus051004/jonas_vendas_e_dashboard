import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  MASKED_SECRET_SENTINEL,
  getSettings,
  provisionElevenLabsResources,
} from "@jonas/shared";

const ProvisionRequestSchema = z.object({
  apiKey: z.string().optional(),
  publicBaseUrl: z.string().min(1, "Informe a URL pública HTTPS do painel."),
  prefix: z.string().max(40, "O prefixo deve ter no máximo 40 caracteres.").optional(),
  voiceId: z.string().optional(),
  llmModel: z.string().max(120, "O modelo de raciocínio deve ter no máximo 120 caracteres.").optional(),
  ttsModelId: z.string().max(120, "O modelo de voz deve ter no máximo 120 caracteres.").optional(),
  phoneNumberId: z.string().optional(),
  agentId: z.string().optional(),
  recreateWebhook: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ProvisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Dados inválidos para provisionamento.";
    return NextResponse.json(
      { ok: false, error: firstIssue, fieldErrors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await provisionElevenLabsResources(parsed.data);
    const updated = await getSettings();

    return NextResponse.json({
      ok: true,
      result,
      settings: {
        elevenLabsApiKey: updated.elevenLabsApiKey ? MASKED_SECRET_SENTINEL : "",
        elevenLabsAgentId: updated.elevenLabsAgentId,
        elevenLabsPhoneNumberId: updated.elevenLabsPhoneNumberId,
        elevenLabsWebhookId: updated.elevenLabsWebhookId,
        elevenLabsWebhookSecret: updated.elevenLabsWebhookSecret ? MASKED_SECRET_SENTINEL : "",
        elevenLabsResourcePrefix: updated.elevenLabsResourcePrefix,
        elevenLabsLlmModel: updated.elevenLabsLlmModel,
        elevenLabsTtsModelId: updated.elevenLabsTtsModelId,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao provisionar recursos na ElevenLabs.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
