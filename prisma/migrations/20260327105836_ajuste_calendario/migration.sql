/*
  Warnings:

  - You are about to drop the column `area` on the `Calendario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Calendario" DROP COLUMN "area",
ADD COLUMN     "departamento" TEXT[];
