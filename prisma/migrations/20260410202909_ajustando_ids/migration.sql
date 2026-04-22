-- CreateEnum
CREATE TYPE "TipoConversa" AS ENUM ('DIRETA', 'GRUPO');

-- CreateTable
CREATE TABLE "UsuarioChat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adObjectGuid" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "empresa" TEXT,
    "departamento" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "TipoConversa" NOT NULL,
    "nome" TEXT,
    "chaveDireta" TEXT,
    "criadoPorId" UUID NOT NULL,
    "ultimaMensagemEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipanteConversa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversaId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaLeituraEm" TIMESTAMP(3),
    "admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ParticipanteConversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversaId" UUID NOT NULL,
    "remetenteId" UUID NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "excluidoEm" TIMESTAMP(3),

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioChat_adObjectGuid_key" ON "UsuarioChat"("adObjectGuid");

-- CreateIndex
CREATE INDEX "UsuarioChat_usuario_idx" ON "UsuarioChat"("usuario");

-- CreateIndex
CREATE INDEX "UsuarioChat_email_idx" ON "UsuarioChat"("email");

-- CreateIndex
CREATE INDEX "UsuarioChat_nome_idx" ON "UsuarioChat"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Conversa_chaveDireta_key" ON "Conversa"("chaveDireta");

-- CreateIndex
CREATE INDEX "Conversa_tipo_idx" ON "Conversa"("tipo");

-- CreateIndex
CREATE INDEX "Conversa_criadoPorId_idx" ON "Conversa"("criadoPorId");

-- CreateIndex
CREATE INDEX "Conversa_ultimaMensagemEm_idx" ON "Conversa"("ultimaMensagemEm");

-- CreateIndex
CREATE INDEX "ParticipanteConversa_conversaId_idx" ON "ParticipanteConversa"("conversaId");

-- CreateIndex
CREATE INDEX "ParticipanteConversa_usuarioId_idx" ON "ParticipanteConversa"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteConversa_conversaId_usuarioId_key" ON "ParticipanteConversa"("conversaId", "usuarioId");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_criadoEm_idx" ON "Mensagem"("conversaId", "criadoEm");

-- CreateIndex
CREATE INDEX "Mensagem_remetenteId_idx" ON "Mensagem"("remetenteId");

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "UsuarioChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteConversa" ADD CONSTRAINT "ParticipanteConversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteConversa" ADD CONSTRAINT "ParticipanteConversa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "UsuarioChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "UsuarioChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
