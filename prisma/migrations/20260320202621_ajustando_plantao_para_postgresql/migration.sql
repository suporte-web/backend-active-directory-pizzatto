-- CreateEnum
CREATE TYPE "Area" AS ENUM ('Sistemas', 'Infra');

-- CreateTable
CREATE TABLE "plantao_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "janela_sis_inicio" TEXT NOT NULL,
    "janela_sis_fim" TEXT NOT NULL,
    "janela_inf_inicio" TEXT NOT NULL,
    "janela_inf_fim" TEXT NOT NULL,
    "escala_sistemas" JSONB NOT NULL,
    "escala_infra" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantao_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantao_contato" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantao_contato_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "plantao_contato" ADD CONSTRAINT "plantao_contato_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "plantao_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
