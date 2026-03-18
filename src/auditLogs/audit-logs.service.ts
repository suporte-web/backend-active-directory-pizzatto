import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listLatest() {
    try {
      return await this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
    } catch (error) {
      this.logger.error('Erro ao buscar audit logs', error);
      throw error; // controller transforma em 500 com mensagem amigável
    }
  }

  async findByFilter(body: any) {
    const page = Number(body.page ?? 1);
    const limit = Number(body.limit ?? 10);
    const skip = (page - 1) * limit;

    const acaoStr = (body.acao ?? '').toString().trim();
    const entidadeStr = (body.entidade ?? '').toString().trim();

    const where: any = {
      filialId: body.filialId,
      ...(acaoStr ? { acao: { contains: acaoStr, mode: 'insensitive' } } : {}),
      ...(entidadeStr
        ? { entidade: { contains: entidadeStr, mode: 'insensitive' } }
        : {}),
    };

    // ✅ Só aplica filtro de data se tiver valor (não vazio)
    const dataInicioRaw = (body.dataInicio ?? '').toString().trim();
    const dataFimRaw = (body.dataFim ?? '').toString().trim();

    if (dataInicioRaw) {
      const dataInicio = new Date(dataInicioRaw);
      const dataFim = dataFimRaw
        ? new Date(dataFimRaw)
        : new Date(dataInicioRaw);

      if (isNaN(dataInicio.getTime())) throw new Error('dataInicio inválida');
      if (isNaN(dataFim.getTime())) throw new Error('dataFim inválida');

      dataInicio.setHours(0, 0, 0, 0);
      dataFim.setHours(0, 0, 0, 0);

      where.createdAt = { gte: dataInicio, lte: dataFim };
    }

    const [result, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { result, total };
  }

  async findByDate(body: any) {
    const { dataInicio, dataFim, filialId } = body;

    if (!dataInicio || !dataFim) {
      throw new BadRequestException('Data de Inicio e Fim são obrigatórios');
    }

    const inicio = new Date(dataInicio);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59, 999);
    return await this.prisma.auditLog.findMany({
      where: {
        // filialId: filialId,
        createdAt: {
          gte: inicio, // maior ou igual à dataInicio
          lte: fim, // menor ou igual à dataFim
        },
      },
      // include: {
      //   filial: true,
      // },
    });
  }
}
