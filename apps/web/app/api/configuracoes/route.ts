import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings } from "@jonas/shared";

const emptyOrUrl = z.union([z.string().url(), z.literal("")]);

const hexColor = z.string().regex(/^#([0-9A-Fa-f]{6})$/);

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
  agentWebhookUrl: emptyOrUrl.optional(),
  outboundWebhookUrl: emptyOrUrl.optional(),
  contractWebhookUrl: emptyOrUrl.optional(),
  outboundWebhookSecret: z.string().nullish(),
  hubsoftBaseUrl: z.string().url().optional(),
  hubsoftVendedorId: z.number().int().positive().optional(),
  hubsoftVencimentoId: z.number().int().positive().optional(),
  hubsoftMotivoContratacaoId: z.number().int().positive().optional(),
  hubsoftGruposClienteIds: z.array(z.number().int()).optional(),
  hubsoftGruposServicoIds: z.array(z.number().int()).optional(),
  hubsoftFormaCobrancaId: z.number().int().positive().optional(),
  hubsoftServicoStatusId: z.number().int().positive().optional(),
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
