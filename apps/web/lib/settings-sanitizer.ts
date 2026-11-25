import type { Settings } from "@jonas/db";
import { MASKED_SECRET_SENTINEL } from "@jonas/shared";

/**
 * Remove segredos e tokens OAuth em texto puro antes de responder ao cliente do painel.
 */
export function sanitizeSettingsForResponse(settings: Settings) {
  const { hubsoftAccessToken, hubsoftRefreshToken, ...rest } = settings;
  return {
    ...rest,
    elevenLabsApiKey: settings.elevenLabsApiKey ? MASKED_SECRET_SENTINEL : "",
    elevenLabsWebhookSecret: settings.elevenLabsWebhookSecret ? MASKED_SECRET_SENTINEL : "",
    hubsoftClientSecret: settings.hubsoftClientSecret ? MASKED_SECRET_SENTINEL : "",
    hubsoftPassword: settings.hubsoftPassword ? MASKED_SECRET_SENTINEL : "",
    hasHubsoftAccessToken: Boolean(hubsoftAccessToken?.trim()),
    hasHubsoftRefreshToken: Boolean(hubsoftRefreshToken?.trim()),
  };
}
