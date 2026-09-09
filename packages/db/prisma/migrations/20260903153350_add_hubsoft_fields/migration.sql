-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "birthDate" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "hubsoftClientId" INTEGER,
ADD COLUMN     "hubsoftProtocol" TEXT,
ADD COLUMN     "hubsoftRawResponse" JSONB,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "motherName" TEXT,
ADD COLUMN     "nationality" TEXT DEFAULT 'brasileiro',
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "profession" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "rgEmissor" TEXT,
ADD COLUMN     "street" TEXT;

-- AlterTable
ALTER TABLE "Origin" ADD COLUMN     "hubsoftOriginId" INTEGER;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "hubsoftServiceId" INTEGER;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "hubsoftBaseUrl" TEXT NOT NULL DEFAULT 'https://api.ligtop.hubsoft.com.br',
ADD COLUMN     "hubsoftFormaCobrancaId" INTEGER NOT NULL DEFAULT 94,
ADD COLUMN     "hubsoftGruposClienteIds" INTEGER[] DEFAULT ARRAY[4]::INTEGER[],
ADD COLUMN     "hubsoftGruposServicoIds" INTEGER[] DEFAULT ARRAY[835]::INTEGER[],
ADD COLUMN     "hubsoftMotivoContratacaoId" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "hubsoftServicoStatusId" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "hubsoftVencimentoId" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "hubsoftVendedorId" INTEGER NOT NULL DEFAULT 636;
