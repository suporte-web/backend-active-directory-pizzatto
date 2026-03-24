/*
  Warnings:

  - You are about to drop the column `localizacaoDepartamento` on the `AssinaturaPadrao` table. All the data in the column will be lost.
  - You are about to drop the column `localizacaoNome` on the `AssinaturaPadrao` table. All the data in the column will be lost.
  - You are about to drop the column `localizacaoPhoto` on the `AssinaturaPadrao` table. All the data in the column will be lost.
  - You are about to drop the column `localizacaoTelefone` on the `AssinaturaPadrao` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AssinaturaPadrao" DROP COLUMN "localizacaoDepartamento",
DROP COLUMN "localizacaoNome",
DROP COLUMN "localizacaoPhoto",
DROP COLUMN "localizacaoTelefone",
ADD COLUMN     "departamentoX" INTEGER,
ADD COLUMN     "departamentoY" INTEGER,
ADD COLUMN     "fontSize" TEXT,
ADD COLUMN     "logoHeight" INTEGER,
ADD COLUMN     "logoX" INTEGER,
ADD COLUMN     "logoY" INTEGER,
ADD COLUMN     "nomeX" INTEGER,
ADD COLUMN     "nomeY" INTEGER,
ADD COLUMN     "photoSize" INTEGER,
ADD COLUMN     "photoX" INTEGER,
ADD COLUMN     "photoY" INTEGER,
ADD COLUMN     "telefoneX" INTEGER,
ADD COLUMN     "telefoneY" INTEGER;
