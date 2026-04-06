import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MuralLikeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(body: any, ip: string, user: any) {
    const create = await this.prisma.muralLike.create({
      data: {
        muralId: body.muralId,
        codigo: user.sam,
        nome: user.name,
      },
    });

    return await this.prisma.auditLog.create({
      data: {
        acao: `Criou o Like para o Mural ${create.muralId}`,
        entidade: user.name,
        filialEntidade: user?.company,
        ipAddress: ip,
      },
    });
  }

  async findByMural(body: any) {
    return await this.prisma.muralLike.findMany({
      where: { muralId: body.muralId },
    });
  }
}
