import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { MuralLikeService } from './muralLike.service';
import { MuralLikeController } from './muralLike.controller';

@Module({
  imports: [AuthModule],
  controllers: [MuralLikeController],
  providers: [MuralLikeService, PrismaService],
  exports: [MuralLikeService],
})
export class MuralLikeModule {}
