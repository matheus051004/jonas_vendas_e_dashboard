-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "hubsoftPackageId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPackage" (
    "planId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,

    CONSTRAINT "PlanPackage_pkey" PRIMARY KEY ("planId","packageId")
);

-- CreateTable
CREATE TABLE "ContractPackage" (
    "contractId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,

    CONSTRAINT "ContractPackage_pkey" PRIMARY KEY ("contractId","packageId")
);

-- AddForeignKey
ALTER TABLE "PlanPackage" ADD CONSTRAINT "PlanPackage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPackage" ADD CONSTRAINT "PlanPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPackage" ADD CONSTRAINT "ContractPackage_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPackage" ADD CONSTRAINT "ContractPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
