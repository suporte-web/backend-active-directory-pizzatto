/*
  Warnings:

  - Added the required column `criadoPor` to the `Mural` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Mural" ADD COLUMN     "criadoPor" TEXT NOT NULL;
