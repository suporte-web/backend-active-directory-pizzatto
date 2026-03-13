import {
  Controller,
  Get,
  Param,
  NotFoundException,
  UseGuards,
  Query,
  Header,
  Res,
} from '@nestjs/common';
import { OrganogramaService } from './organograma.service';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { OrganogramaPdfService } from './organograma-pdf.service';
import type { Response } from 'express';

@ApiTags('Organograma')
@Controller('organograma')
@UseGuards(AuthGuard)
export class OrganogramaController {
  constructor(
    private readonly organogramaService: OrganogramaService,
    private readonly organogramaPdfService: OrganogramaPdfService,
  ) {}

  @Get('get-organograma-completo')
  async getOrganogramaCompleto() {
    return this.organogramaService.obterOrganogramaCompleto();
  }

  @Get('usuario/:username')
  async getOrganogramaPorUsuario(@Param('username') username: string) {
    const node =
      await this.organogramaService.obterOrganogramaPorUsuario(username);

    if (!node) {
      throw new NotFoundException(
        `Usuário "${username}" não encontrado no organograma`,
      );
    }

    return node;
  }

  @Get('roots')
  async getRoots() {
    return this.organogramaService.listarColaboradoresSemGestor();
  }

  @Get('colaborador')
  async getOrganogramaPorColaborador(@Query('termo') termo: string) {
    const resultado =
      await this.organogramaService.obterOrganogramaPorColaborador(termo);

    if (!resultado) {
      throw new NotFoundException('Colaborador não encontrado');
    }

    return resultado;
  }

  @Get('departamento')
  async getOrganogramaPorDepartamento(@Query('nome') nome: string) {
    return this.organogramaService.obterOrganogramaPorDepartamento(nome);
  }

  @Get('pdf')
  async gerarPdf(
    @Query('tipo')
    tipo: 'completo' | 'departamento' | 'colaborador' = 'completo',
    @Query('valor') valor: string,
    @Res() res: Response,
  ) {
    const pdf = await this.organogramaPdfService.gerarPdf({ tipo, valor });

    const valorSeguro = valor ? this.sanitizeFileName(valor) : '';

    const nomeArquivo =
      tipo === 'departamento' && valorSeguro
        ? `organograma-departamento-${valorSeguro}.pdf`
        : tipo === 'colaborador' && valorSeguro
          ? `organograma-colaborador-${valorSeguro}.pdf`
          : 'organograma-completo.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nomeArquivo}"`,
    );
    res.setHeader('Content-Length', pdf.length.toString());

    res.end(pdf);
  }

  private sanitizeFileName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }
}
