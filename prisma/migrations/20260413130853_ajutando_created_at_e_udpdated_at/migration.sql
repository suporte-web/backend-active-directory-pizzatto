/*
  Warnings:

  - You are about to drop the column `atualizadoEm` on the `Conversa` table. All the data in the column will be lost.
  - You are about to drop the column `criadoEm` on the `Conversa` table. All the data in the column will be lost.
  - You are about to drop the column `atualizadoEm` on the `Mensagem` table. All the data in the column will be lost.
  - You are about to drop the column `criadoEm` on the `Mensagem` table. All the data in the column will be lost.
  - You are about to drop the column `excluidoEm` on the `Mensagem` table. All the data in the column will be lost.
  - You are about to drop the column `atualizadoEm` on the `UsuarioChat` table. All the data in the column will be lost.
  - You are about to drop the column `criadoEm` on the `UsuarioChat` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Mensagem_conversaId_criadoEm_idx";

-- AlterTable
ALTER TABLE "Conversa" DROP COLUMN "atualizadoEm",
DROP COLUMN "criadoEm",
ADD COLUMN     "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Mensagem" DROP COLUMN "atualizadoEm",
DROP COLUMN "criadoEm",
DROP COLUMN "excluidoEm",
ADD COLUMN     "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ParticipanteConversa" ADD COLUMN     "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UsuarioChat" DROP COLUMN "atualizadoEm",
DROP COLUMN "criadoEm",
ADD COLUMN     "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_createdAt_idx" ON "Mensagem"("conversaId", "createdAt");
