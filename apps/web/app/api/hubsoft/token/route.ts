import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  MASKED_SECRET_SENTINEL,
  getSettings,
  requestNewHubsoftToken,
  updateSettings,
} from "@jonas/shared";
import { sanitizeSettingsForResponse } from "@/lib/settings-sanitizer";

const RenewTokenBodySchema = z.object({
  hubsoftBaseUrl: z.string().url("Informe uma URL base válida").optional(),
  hubsoftClientId: z.string().max(120).optional(),
  hubsoftClientSecret: z.string().max(255).optional(),
  hubsoftUsername: z.string().max(255).optional(),
  hubsoftPassword: z.string().max(255).optional(),
});

export async function POST(req: NextRequest) {
  const rawBody = await req.json().catch(() => ({}));
  const parsed = RenewTokenBodySchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Credenciais inválidas.";
    return NextResponse.json(
      { ok: false, error: firstIssue, fieldErrors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const patch: Parameters<typeof updateSettings>[0] = {};
    const {
      hubsoftBaseUrl,
      hubsoftClientId,
      hubsoftClientSecret,
      hubsoftUsername,
      hubsoftPassword,
    } = parsed.data;

    if (hubsoftBaseUrl !== undefined) patch.hubsoftBaseUrl = hubsoftBaseUrl.trim();
    if (hubsoftClientId !== undefined) patch.hubsoftClientId = hubsoftClientId.trim();
    if (hubsoftUsername !== undefined) patch.hubsoftUsername = hubsoftUsername.trim();
    if (hubsoftClientSecret !== undefined && hubsoftClientSecret !== MASKED_SECRET_SENTINEL) {
      patch.hubsoftClientSecret = hubsoftClientSecret;
    }
    if (hubsoftPassword !== undefined && hubsoftPassword !== MASKED_SECRET_SENTINEL) {
      patch.hubsoftPassword = hubsoftPassword;
    }

    if (Object.keys(patch).length > 0) {
      await updateSettings(patch);
    }

    const tokenResult = await requestNewHubsoftToken();
    const updated = await getSettings({ bypassCache: true });

    return NextResponse.json({
      ok: true,
      token: {
        updatedAt: tokenResult.updatedAt.toISOString(),
        expiresAt: tokenResult.expiresAt ? tokenResult.expiresAt.toISOString() : null,
      },
      settings: sanitizeSettingsForResponse(updated),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao gerar token OAuth no Hubsoft.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
