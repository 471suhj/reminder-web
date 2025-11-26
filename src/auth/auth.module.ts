import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EncryptModule } from '../encrypt/encrypt.module';

@Module({
  imports: [EncryptModule],
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}
