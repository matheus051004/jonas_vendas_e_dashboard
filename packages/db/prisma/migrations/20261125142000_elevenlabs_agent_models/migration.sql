-- Add configurable LLM reasoning model and TTS voice model for ElevenLabs agent
ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "elevenLabsLlmModel" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "elevenLabsTtsModelId" TEXT NOT NULL DEFAULT '';
