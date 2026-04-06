import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';
import { AuditLogsService } from './audit-logs.service';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(AuthGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('audit-all-logs')
  @ApiOperation({ summary: 'Encontra todos os Logs de Auditoria' })
  async list() {
    try {
      return await this.auditLogsService.listLatest();
    } catch (error) {
      // Você pode logar aqui também, mas o ideal é deixar o service logar
      throw new InternalServerErrorException('Erro ao buscar audit logs');
    }
  }

  @Post('find-by-filter')
  @ApiOperation({ summary: 'Encontra os Logs Filtrando' })
  async findByFilter(@Body() body: any) {
    return await this.auditLogsService.findByFilter(body);
  }

  @Get('get-ip-address')
  @ApiOperation({
    summary: 'Encontra o Endereço de IP da Máquina do colaborador',
  })
  getIp(@Req() req: Request) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    return { ip };
  }

  @Post('find-by-date')
  @ApiOperation({ summary: 'Encontra Logs de Auditoria por meio de Data' })
  async findByDate(@Body() body: any) {
    return await this.auditLogsService.findByDate(body);
  }
}
