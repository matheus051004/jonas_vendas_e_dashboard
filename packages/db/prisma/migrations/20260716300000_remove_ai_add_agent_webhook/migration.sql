-- Remove campos de IA local; adiciona webhook do sistema de IA externo.
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "aiModel";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "maxCompletionTokens";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "temperature";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "reasoningEffort";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "openAiApiKey";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "generalPrompt";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "keyPoints";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "toolDescUpdateClient";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "toolDescListOrigins";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "toolDescListAreas";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "toolDescListPlansByArea";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "toolDescSetStage";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "toolDescRegisterContract";

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "agentWebhookUrl" TEXT NOT NULL DEFAULT '';
