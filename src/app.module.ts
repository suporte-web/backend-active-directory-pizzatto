import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserAdModule } from './userAd/userAd.module';
import { OrganogramaModule } from './organograma/organograma.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserAdModule,
    OrganogramaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
