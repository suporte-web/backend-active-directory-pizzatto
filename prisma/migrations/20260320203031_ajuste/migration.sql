/*
  Warnings:

  - You are about to drop the column `created_at` on the `plantao_config` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `plantao_config` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `plantao_contato` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `plantao_contato` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "plantao_config" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "plantao_contato" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
