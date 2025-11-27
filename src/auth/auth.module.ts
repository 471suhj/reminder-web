import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EncryptModule } from '../encrypt/encrypt.module';
import { HashPasswordModule } from '../hash-password/hash-password.module';

@Module({
  imports: [EncryptModule, HashPasswordModule],
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}
