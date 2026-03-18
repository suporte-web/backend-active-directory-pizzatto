/*
  Warnings:

  - Added the required column `validoAte` to the `Mural` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Mural" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "validoAte" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "ipAddress" TEXT,
    "filialEntidade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
