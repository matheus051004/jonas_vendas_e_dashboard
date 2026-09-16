-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "dueDateId" TEXT;

-- CreateTable
CREATE TABLE "DueDate" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "hubsoftId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DueDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DueDate_day_key" ON "DueDate"("day");

-- CreateIndex
CREATE INDEX "DueDate_day_idx" ON "DueDate"("day");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_dueDateId_fkey" FOREIGN KEY ("dueDateId") REFERENCES "DueDate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
