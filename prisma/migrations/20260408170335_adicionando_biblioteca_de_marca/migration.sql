-- CreateTable
CREATE TABLE "BibliotecaMarca" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "caminhoArquivo" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "descricao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BibliotecaMarca_pkey" PRIMARY KEY ("id")
);
