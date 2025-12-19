import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserAdSchema } from './userAd.schema';
import { AuthModule } from 'src/auth/auth.module';
import { UserAdController } from './userAd.controller';
import { UserAdService } from './userAd.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'UserAd', schema: UserAdSchema }]),
    AuthModule,
  ],
  controllers: [UserAdController],
  providers: [UserAdService],
  exports: [UserAdService],
})
export class UserAdModule {}
