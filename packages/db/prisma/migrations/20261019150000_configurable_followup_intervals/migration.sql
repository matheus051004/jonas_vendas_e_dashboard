-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "followUpIntervals" INTEGER[] DEFAULT ARRAY[60, 120, 180]::INTEGER[];
