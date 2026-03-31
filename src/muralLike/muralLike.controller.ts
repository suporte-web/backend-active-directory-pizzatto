import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { MuralLikeService } from './muralLike.service';
import { ClientIp } from 'src/decorator/client-ip.decorator';
import { User } from 'src/decorator/user.decorator';

@ApiTags('MuralLike')
@Controller('mural-like')
@UseGuards(AuthGuard)
export class MuralLikeController {
  constructor(private readonly service: MuralLikeService) {}

  @Post('create')
  @ApiOperation({ summary: 'Cria o Like no Mural' })
  async createMural(
    @Body() body: any,
    @ClientIp() ip: string,
    @User() user: any,
  ) {
    return await this.service.create(body, ip, user);
  }

  @Post('find-by-mural')
  @ApiOperation({ summary: 'Encontra todos os Likes do Mural especifico' })
  async findByMural(@Body() body: any) {
    return await this.service.findByMural(body);
  }
}
