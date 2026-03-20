import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { MuralController } from './mural.controller';
import { MuralService } from './mural.service';

@Module({
  imports: [AuthModule],
  controllers: [MuralController],
  providers: [MuralService, PrismaService],
  exports: [MuralService],
})
export class MuralModule {}