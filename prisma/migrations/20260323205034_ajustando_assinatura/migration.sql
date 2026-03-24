/*
  Warnings:

  - You are about to drop the column `cargo` on the `Assinatura` table. All the data in the column will be lost.
  - Added the required column `departamento` to the `Assinatura` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Assinatura" DROP COLUMN "cargo",
ADD COLUMN     "departamento" TEXT NOT NULL;
