import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MuralService {
  constructor(private readonly prisma: PrismaService) {}

  async createMural(
    body: any,
    file: Express.Multer.File,
    ip: string,
    user: any,
  ) {
    const filiais = Array.isArray(body.filiais)
      ? body.filiais
      : body.filiais
        ? [body.filiais]
        : [];

    const caminhoImagem = file ? `downloads/mural/${file.filename}` : null;
    const importante = body.importante === 'true';
    const create = await this.prisma.mural.create({
      data: {
        titulo: body.titulo,
        mensagem: body.mensagem,
        validoAte: body.validoAte,
        criadoPor: user.name,
        departamentoCriador: user.department,
        caminhoImagem,
        filiais,
        importante,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        acao: `Criou o Mural ${create.titulo}`,
        entidade: user.name,
        filialEntidade: user?.company,
        ipAddress: ip,
      },
    });

    return create;
  }

  async getAllByFilial(user: any) {
    const nowDate = new Date();
    nowDate.setHours(nowDate.getHours() - 3);
    const now = nowDate.toISOString().slice(0, 16);
    
    const murais = await this.prisma.mural.findMany({
      where: {
        validoAte: {
          gte: now,
        },
        filiais: {
          has: user.company,
        },
      },
    });

    return murais;
  }
}
