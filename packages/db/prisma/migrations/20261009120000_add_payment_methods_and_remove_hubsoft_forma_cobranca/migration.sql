-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "hubsoftFormaCobrancaId";

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "paymentMethodId" TEXT;

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hubsoftId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentMethod_hubsoftId_idx" ON "PaymentMethod"("hubsoftId");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
