import {
  Body,
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Get,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { MuralService } from './mural.service';
import { User } from '../decorator/user.decorator';
import { ClientIp } from '../decorator/client-ip.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('mural')
@Controller('mural')
@UseGuards(AuthGuard)
export class MuralController {
  constructor(private readonly service: MuralService) {}

  @Post('create')
  @ApiOperation({ summary: 'Cria o Mural' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('imagem', {
      storage: diskStorage({
        destination: './downloads/mural',
        filename: (req, file, callback) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, uniqueName + extname(file.originalname));
        },
      }),
    }),
  )
  async createMural(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @ClientIp() ip: string,
    @User() user: any,
  ) {
    return await this.service.createMural(body, file, ip, user);
  }

  @Get('get-all-by-filial')
  @ApiOperation({ summary: 'Encontra todos os Murais por Filial' })
  async getAllByFilial(@User() user: any) {
    return await this.service.getAllByFilial(user);
  }
}
