-- CreateTable
CREATE TABLE "PaginaInstitucional" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "caminhoImagem" TEXT[],
    "dataAtualizacao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaginaInstitucional_pkey" PRIMARY KEY ("id")
);
