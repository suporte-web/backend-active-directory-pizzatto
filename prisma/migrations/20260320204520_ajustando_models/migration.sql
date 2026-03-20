/*
  Warnings:

  - You are about to drop the `plantao_config` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plantao_contato` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "plantao_contato" DROP CONSTRAINT "plantao_contato_config_id_fkey";

-- DropTable
DROP TABLE "plantao_config";

-- DropTable
DROP TABLE "plantao_contato";

-- CreateTable
CREATE TABLE "PlantaoConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "janelaSisInicio" TEXT NOT NULL,
    "janelaSisFim" TEXT NOT NULL,
    "janelaInfInicio" TEXT NOT NULL,
    "janelaInfFim" TEXT NOT NULL,
    "escalaSistemas" JSONB NOT NULL,
    "escalaInfra" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantaoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantaoContato" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configId" UUID NOT NULL,

    CONSTRAINT "PlantaoContato_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlantaoContato" ADD CONSTRAINT "PlantaoContato_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PlantaoConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
