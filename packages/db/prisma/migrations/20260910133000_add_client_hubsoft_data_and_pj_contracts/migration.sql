-- AlterEnum
ALTER TYPE "SaleStage" ADD VALUE 'PAROU_DE_RESPONDER';
ALTER TYPE "SaleStage" ADD VALUE 'ACHOU_CARO';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "hubsoftData" JSONB;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "personType" TEXT NOT NULL DEFAULT 'pf',
ADD COLUMN     "stateRegistration" TEXT,
ADD COLUMN     "tradeName" TEXT,
ALTER COLUMN "fullName" SET DEFAULT '',
ALTER COLUMN "cpf" DROP NOT NULL,
ALTER COLUMN "gender" DROP NOT NULL;
