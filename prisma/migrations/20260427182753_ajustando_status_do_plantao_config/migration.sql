/*
  Warnings:

  - Added the required column `status` to the `PlantaoConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PlantaoConfig" ADD COLUMN     "status" TEXT NOT NULL;
