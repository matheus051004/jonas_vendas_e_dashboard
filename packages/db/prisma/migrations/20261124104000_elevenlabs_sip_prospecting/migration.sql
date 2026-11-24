-- AlterTable
ALTER TABLE "Settings" RENAME COLUMN "prospectingWebhookUrl" TO "prospectingTextWebhookUrl";

-- AlterTable
ALTER TABLE "Settings"
ADD COLUMN "voiceFirstMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN "elevenLabsApiKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN "elevenLabsAgentId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "elevenLabsPhoneNumberId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "elevenLabsWebhookSecret" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ProspectLead"
ADD COLUMN "elevenLabsConversationId" TEXT,
ADD COLUMN "elevenLabsSipCallId" TEXT,
ADD COLUMN "callDurationSecs" INTEGER,
ADD COLUMN "callSummary" TEXT;

-- CreateIndex
CREATE INDEX "ProspectLead_elevenLabsConversationId_idx" ON "ProspectLead"("elevenLabsConversationId");
