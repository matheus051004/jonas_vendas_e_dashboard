-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "followUpPaused" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "followUpEndTime" TEXT DEFAULT '20:00',
ADD COLUMN     "followUpStartTime" TEXT DEFAULT '08:00';
