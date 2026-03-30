-- CreateTable
CREATE TABLE "Politicas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caminhoArquivo" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "departamentoResponsavel" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "dataUpload" TEXT,
    "criadoPor" TEXT,
    "versão" TEXT NOT NULL DEFAULT '1',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "liberadoVisualizacao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Politicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticaAceites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "colaborador" TEXT NOT NULL,
    "dataAceite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "politicaId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoliticaAceites_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PoliticaAceites" ADD CONSTRAINT "PoliticaAceites_politicaId_fkey" FOREIGN KEY ("politicaId") REFERENCES "Politicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
