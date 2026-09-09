-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hubsoftPromotionId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPromotion" (
    "planId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,

    CONSTRAINT "PlanPromotion_pkey" PRIMARY KEY ("planId","promotionId")
);

-- AddForeignKey
ALTER TABLE "PlanPromotion" ADD CONSTRAINT "PlanPromotion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPromotion" ADD CONSTRAINT "PlanPromotion_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
