import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrganogramaController } from './organograma.controller';
import { OrganogramaService } from './organograma.service';
import { AuthModule } from '../auth/auth.module';
import { OrganogramaPdfService } from './organograma-pdf.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [OrganogramaController],
  providers: [OrganogramaService, OrganogramaPdfService],
  exports: [OrganogramaService, OrganogramaPdfService],
})
export class OrganogramaModule {}
