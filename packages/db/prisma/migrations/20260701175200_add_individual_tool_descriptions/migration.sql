-- Drop old column
ALTER TABLE "Settings" DROP COLUMN "toolsDescription";

-- Add individual tool description columns
ALTER TABLE "Settings" ADD COLUMN "toolDescUpdateClient" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "toolDescListOrigins" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "toolDescListPlansByCep" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "toolDescSetStage" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "toolDescRegisterContract" TEXT NOT NULL DEFAULT '';
