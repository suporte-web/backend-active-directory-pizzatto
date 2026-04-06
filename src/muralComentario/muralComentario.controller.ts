import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ClientIp } from '../decorator/client-ip.decorator';
import { User } from '../decorator/user.decorator';
import { MuralComentarioService } from './muralComentario.service';

@ApiTags('MuralComentario')
@Controller('mural-comentario')
@UseGuards(AuthGuard)
export class MuralComentarioController {
  constructor(private readonly service: MuralComentarioService) {}

  @Post('create')
  @ApiOperation({ summary: 'Cria o Comentario no Mural' })
  async createMural(
    @Body() body: any,
    @ClientIp() ip: string,
    @User() user: any,
  ) {
    return await this.service.create(body, ip, user);
  }

  @Post('find-by-mural')
  @ApiOperation({ summary: 'Encontra todos os Comentario do Mural especifico' })
  async findByMural(@Body() body: any) {
    return await this.service.findByMural(body);
  }
}
