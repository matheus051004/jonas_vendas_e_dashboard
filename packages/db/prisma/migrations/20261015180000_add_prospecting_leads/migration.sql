-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('PENDENTE', 'EM_CHAMADA', 'ATENDEU', 'NAO_ATENDEU', 'TEXTO_ENVIADO', 'ERRO');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "isProspectingActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prospectingWebhookUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "textAiPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "voiceAiPrompt" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ProspectLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "secondaryPhone" TEXT,
    "email" TEXT,
    "rawDocument" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "cep" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'PENDENTE',
    "lastAction" TEXT,
    "calledAt" TIMESTAMP(3),
    "textSentAt" TIMESTAMP(3),
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProspectLead_phone_key" ON "ProspectLead"("phone");

-- CreateIndex
CREATE INDEX "ProspectLead_status_idx" ON "ProspectLead"("status");

-- CreateIndex
CREATE INDEX "ProspectLead_phone_idx" ON "ProspectLead"("phone");

-- CreateIndex
CREATE INDEX "ProspectLead_createdAt_idx" ON "ProspectLead"("createdAt");

-- AddForeignKey
ALTER TABLE "ProspectLead" ADD CONSTRAINT "ProspectLead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
