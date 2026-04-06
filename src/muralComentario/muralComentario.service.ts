import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MuralComentarioService {
  constructor(private readonly prisma: PrismaService) {}

  async create(body: any, ip: string, user: any) {
    const create = await this.prisma.muralComentario.create({
      data: {
        muralId: body.muralId,
        comentario: body.comentario,
        codigo: user.sam,
        nome: user.name,
      },
    });

    return await this.prisma.auditLog.create({
      data: {
        acao: `Criou um Comentario para o Mural ${create.muralId}`,
        entidade: user.name,
        filialEntidade: user?.company,
        ipAddress: ip,
      },
    });
  }

  async findByMural(body: any) {
    return await this.prisma.muralComentario.findMany({
      where: { muralId: body.muralId },
    });
  }
}