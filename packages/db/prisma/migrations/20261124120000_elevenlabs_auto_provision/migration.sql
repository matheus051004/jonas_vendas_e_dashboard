-- Add idempotent provisioning fields for ElevenLabs auto-sync
ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "elevenLabsWebhookId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "elevenLabsResourcePrefix" TEXT NOT NULL DEFAULT 'painel_vendas';
