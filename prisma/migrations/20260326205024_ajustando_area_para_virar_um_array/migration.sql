/*
  Warnings:

  - The `area` column on the `Calendario` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Calendario" DROP COLUMN "area",
ADD COLUMN     "area" TEXT[];
