import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { MuralLikeService } from './muralLike.service';
import { MuralLikeController } from './muralLike.controller';

@Module({
  imports: [AuthModule],
  controllers: [MuralLikeController],
  providers: [MuralLikeService, PrismaService],
  exports: [MuralLikeService],
})
export class MuralLikeModule {}
