/*
  Warnings:

  - You are about to drop the column `departamento` on the `Calendario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Calendario" DROP COLUMN "departamento",
ADD COLUMN     "colaboradores" TEXT[];
