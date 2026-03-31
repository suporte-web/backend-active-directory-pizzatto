/*
  Warnings:

  - You are about to drop the column `versão` on the `Politicas` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Politicas" DROP COLUMN "versão",
ADD COLUMN     "versao" TEXT NOT NULL DEFAULT '1';

-- CreateTable
CREATE TABLE "MuralLike" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "muralId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuralLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuralComentario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "muralId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "comentario" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuralComentario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MuralLike_muralId_idx" ON "MuralLike"("muralId");

-- CreateIndex
CREATE UNIQUE INDEX "MuralLike_muralId_codigo_key" ON "MuralLike"("muralId", "codigo");

-- CreateIndex
CREATE INDEX "MuralComentario_muralId_idx" ON "MuralComentario"("muralId");

-- AddForeignKey
ALTER TABLE "MuralLike" ADD CONSTRAINT "MuralLike_muralId_fkey" FOREIGN KEY ("muralId") REFERENCES "Mural"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuralComentario" ADD CONSTRAINT "MuralComentario_muralId_fkey" FOREIGN KEY ("muralId") REFERENCES "Mural"("id") ON DELETE CASCADE ON UPDATE CASCADE;
