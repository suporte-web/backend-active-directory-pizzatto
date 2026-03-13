-- CreateTable
CREATE TABLE "Mural" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "caminhoImagem" TEXT,
    "filiais" TEXT[],
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mural_pkey" PRIMARY KEY ("id")
);
