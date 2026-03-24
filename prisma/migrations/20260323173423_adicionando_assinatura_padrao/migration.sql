-- CreateTable
CREATE TABLE "AssinaturaPadrao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caminhoBackground" TEXT,
    "corFont" TEXT,
    "localizacaoPhoto" TEXT,
    "localizacaoNome" TEXT,
    "localizacaoDepartamento" TEXT,
    "localizacaoTelefone" TEXT,
    "criadoPor" TEXT,
    "isAtual" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssinaturaPadrao_pkey" PRIMARY KEY ("id")
);
