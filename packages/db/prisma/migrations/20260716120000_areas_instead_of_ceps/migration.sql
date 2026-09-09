-- CreateTable Area
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "observation" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable AreaPlan
CREATE TABLE "AreaPlan" (
    "areaId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,

    CONSTRAINT "AreaPlan_pkey" PRIMARY KEY ("areaId","planId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_name_key" ON "Area"("name");

-- AddForeignKey
ALTER TABLE "AreaPlan" ADD CONSTRAINT "AreaPlan_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaPlan" ADD CONSTRAINT "AreaPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Client: cep (texto livre) → areaId (FK opcional)
ALTER TABLE "Client" ADD COLUMN "areaId" TEXT;

-- Migra CEPs existentes para Áreas (code vira name; city vira observation se houver)
INSERT INTO "Area" ("id", "name", "observation", "active", "createdAt")
SELECT "id", "code", "city", "active", "createdAt" FROM "Cep";

INSERT INTO "AreaPlan" ("areaId", "planId")
SELECT "cepId", "planId" FROM "CepPlan";

-- Drop old Cep tables
DROP TABLE "CepPlan";
DROP TABLE "Cep";

-- Drop Client.cep
ALTER TABLE "Client" DROP COLUMN "cep";

-- CreateIndex
CREATE INDEX "Client_areaId_idx" ON "Client"("areaId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Settings: toolDescListPlansByCep → toolDescListAreas + toolDescListPlansByArea
ALTER TABLE "Settings" ADD COLUMN "toolDescListAreas" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "toolDescListPlansByArea" TEXT NOT NULL DEFAULT '';

-- Copia descrição antiga se existir
UPDATE "Settings"
SET "toolDescListPlansByArea" = "toolDescListPlansByCep"
WHERE "toolDescListPlansByCep" IS NOT NULL AND "toolDescListPlansByCep" <> '';

ALTER TABLE "Settings" DROP COLUMN "toolDescListPlansByCep";
