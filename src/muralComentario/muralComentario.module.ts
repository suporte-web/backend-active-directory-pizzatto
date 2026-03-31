import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MuralComentarioController } from './muralComentario.controller';
import { MuralComentarioService } from './muralComentario.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [MuralComentarioController],
  providers: [MuralComentarioService, PrismaService],
  exports: [MuralComentarioService],
})
export class MuralComentarioModule {}
