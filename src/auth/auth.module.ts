import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from 'src/user/user.schema';
import { AuthService } from './auth.service';
// import { CodeSchema } from './schemas/code.schema';

@Module({
  imports: [
     MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    //  MongooseModule.forFeature([{ name: 'Code', schema: CodeSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule { }