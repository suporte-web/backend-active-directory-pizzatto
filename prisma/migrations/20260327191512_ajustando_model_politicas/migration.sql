/*
  Warnings:

  - You are about to drop the column `departamentoResponsavel` on the `Politicas` table. All the data in the column will be lost.
  - You are about to drop the column `tipo` on the `Politicas` table. All the data in the column will be lost.
  - Added the required column `departamento` to the `Politicas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoPolitica` to the `Politicas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Politicas" DROP COLUMN "departamentoResponsavel",
DROP COLUMN "tipo",
ADD COLUMN     "departamento" TEXT NOT NULL,
ADD COLUMN     "tipoPolitica" TEXT NOT NULL;
