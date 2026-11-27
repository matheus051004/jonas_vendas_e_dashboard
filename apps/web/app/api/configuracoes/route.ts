import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  MASKED_SECRET_SENTINEL,
  getSettings,
  normalizeElevenLabsPrefix,
  updateSettings,
} from "@jonas/shared";
import { sanitizeSettingsForResponse } from "@/lib/settings-sanitizer";

const emptyOrUrl = z.union([z.string().url(), z.literal("")]);

const hexColor = z.string().regex(/^#([0-9A-Fa-f]{6})$/);

const timeFormat = z
  .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm (ex: 08:00)"), z.literal("")])
  .nullable()
  .optional()
  .transform((val) => (val === "" ? null : val));

// Logo data URL: limite ~750 KB de base64 (~500 KB de arquivo) para não estourar o body/JSON.
const brandLogo = z
  .string()
  .max(1_000_000, "Logo muito grande — use imagem menor (até ~500 KB)")
  .nullable();

const SettingsUpdateSchema = z.object({
  brandName: z.string().min(1).max(80).optional(),
  brandLogo: brandLogo.optional(),
  colorPrimary: hexColor.optional(),
  colorSecondary: hexColor.optional(),
  colorBackground: hexColor.optional(),
  aiPrompt: z.string().optional(),
  voiceAiPrompt: z.string().optional(),
  voiceFirstMessage: z.string().optional(),
  textAiPrompt: z.string().optional(),
  elevenLabsApiKey: z.string().optional(),
  elevenLabsAgentId: z.string().optional(),
  elevenLabsPhoneNumberId: z.string().optional(),
  elevenLabsWebhookSecret: z.string().optional(),
  elevenLabsResourcePrefix: z.string().max(40).optional(),
  elevenLabsLlmModel: z.string().max(120).optional(),
  elevenLabsTtsModelId: z.string().max(120).optional(),
  agentWebhookUrl: emptyOrUrl.optional(),
  outboundWebhookUrl: emptyOrUrl.optional(),
  contractWebhookUrl: emptyOrUrl.optional(),
  prospectingTextWebhookUrl: emptyOrUrl.optional(),
  outboundWebhookSecret: z.string().nullish(),
  followUpStartTime: timeFormat,
  followUpEndTime: timeFormat,
  followUpIntervals: z.array(z.number().int().min(1).max(43200)).min(1).max(10).optional(),
  hubsoftBaseUrl: z.string().url().optional(),
  hubsoftClientId: z.string().max(120).optional(),
  hubsoftClientSecret: z.string().max(255).optional(),
  hubsoftUsername: z.string().max(255).optional(),
  hubsoftPassword: z.string().max(255).optional(),
  hubsoftVendedorId: z.number().int().positive().optional(),
  hubsoftMotivoContratacaoId: z.number().int().positive().optional(),
  hubsoftGruposClienteIds: z.array(z.number().int()).optional(),
  hubsoftGruposServicoIds: z.array(z.number().int()).optional(),
  hubsoftServicoStatusId: z.number().int().positive().optional(),
  hubsoftCarne: z.boolean().optional(),
});

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(sanitizeSettingsForResponse(settings));
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = SettingsUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updateData = { ...parsed.data };
  if (updateData.elevenLabsApiKey === MASKED_SECRET_SENTINEL) {
    delete updateData.elevenLabsApiKey;
  }
  if (updateData.elevenLabsWebhookSecret === MASKED_SECRET_SENTINEL) {
    delete updateData.elevenLabsWebhookSecret;
  }
  if (updateData.hubsoftClientSecret === MASKED_SECRET_SENTINEL) {
    delete updateData.hubsoftClientSecret;
  }
  if (updateData.hubsoftPassword === MASKED_SECRET_SENTINEL) {
    delete updateData.hubsoftPassword;
  }
  if (typeof updateData.hubsoftClientId === "string") {
    updateData.hubsoftClientId = updateData.hubsoftClientId.trim();
  }
  if (typeof updateData.hubsoftUsername === "string") {
    updateData.hubsoftUsername = updateData.hubsoftUsername.trim();
  }
  if (typeof updateData.elevenLabsResourcePrefix === "string") {
    updateData.elevenLabsResourcePrefix = normalizeElevenLabsPrefix(
      updateData.elevenLabsResourcePrefix
    );
  }

  const settings = await updateSettings(updateData);
  return NextResponse.json(sanitizeSettingsForResponse(settings));
}
