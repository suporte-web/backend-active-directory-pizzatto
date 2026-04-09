/*
  Warnings:

  - You are about to drop the column `escalaInfra` on the `PlantaoConfig` table. All the data in the column will be lost.
  - You are about to drop the column `escalaSistemas` on the `PlantaoConfig` table. All the data in the column will be lost.
  - You are about to drop the column `janelaInfFim` on the `PlantaoConfig` table. All the data in the column will be lost.
  - You are about to drop the column `janelaInfInicio` on the `PlantaoConfig` table. All the data in the column will be lost.
  - You are about to drop the column `janelaSisFim` on the `PlantaoConfig` table. All the data in the column will be lost.
  - You are about to drop the column `janelaSisInicio` on the `PlantaoConfig` table. All the data in the column will be lost.
  - You are about to drop the column `configId` on the `PlantaoContato` table. All the data in the column will be lost.
  - Added the required column `dataJanela` to the `PlantaoConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `janelaFim` to the `PlantaoConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `janelaInicio` to the `PlantaoConfig` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PlantaoContato" DROP CONSTRAINT "PlantaoContato_configId_fkey";

-- AlterTable
ALTER TABLE "PlantaoConfig" DROP COLUMN "escalaInfra",
DROP COLUMN "escalaSistemas",
DROP COLUMN "janelaInfFim",
DROP COLUMN "janelaInfInicio",
DROP COLUMN "janelaSisFim",
DROP COLUMN "janelaSisInicio",
ADD COLUMN     "dataJanela" TEXT NOT NULL,
ADD COLUMN     "janelaFim" TEXT NOT NULL,
ADD COLUMN     "janelaInicio" TEXT NOT NULL,
ADD COLUMN     "plantonistaId" UUID;

-- AlterTable
ALTER TABLE "PlantaoContato" DROP COLUMN "configId";

-- AddForeignKey
ALTER TABLE "PlantaoConfig" ADD CONSTRAINT "PlantaoConfig_plantonistaId_fkey" FOREIGN KEY ("plantonistaId") REFERENCES "PlantaoContato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
