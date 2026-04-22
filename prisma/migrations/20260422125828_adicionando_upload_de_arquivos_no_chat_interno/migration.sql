-- CreateEnum
CREATE TYPE "TipoMensagem" AS ENUM ('TEXTO', 'IMAGEM', 'ARQUIVO');

-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN     "arquivoUrl" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "nomeArquivo" TEXT,
ADD COLUMN     "tamanhoBytes" INTEGER,
ADD COLUMN     "tipo" "TipoMensagem" NOT NULL DEFAULT 'TEXTO',
ALTER COLUMN "conteudo" DROP NOT NULL;
