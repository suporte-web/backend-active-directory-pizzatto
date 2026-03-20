-- CreateTable
CREATE TABLE "ToDo" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "prazoLimite" TEXT,
    "responsavel" TEXT NOT NULL,
    "finalizado" BOOLEAN NOT NULL DEFAULT false,
    "dataFinalizado" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToDo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContasOffice" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContasOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventarioImpressoras" (
    "id" UUID NOT NULL,
    "filial" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "numeroSerie" TEXT,
    "ip" TEXT NOT NULL,
    "macLan" TEXT NOT NULL,
    "macWlan" TEXT,
    "localizacao" TEXT,
    "senhaAdministrador" TEXT,
    "etiqueta" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventarioImpressoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pops" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pops_pkey" PRIMARY KEY ("id")
);
