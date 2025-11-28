import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EncryptModule } from '../encrypt/encrypt.module';
import { HashPasswordModule } from '../hash-password/hash-password.module';
import { SignupModule } from '../signup/signup.module';

@Module({
  imports: [EncryptModule, HashPasswordModule, SignupModule],
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}
