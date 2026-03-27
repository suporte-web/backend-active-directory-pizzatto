/*
  Warnings:

  - Added the required column `area` to the `Calendario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Calendario" ADD COLUMN     "area" TEXT NOT NULL;
