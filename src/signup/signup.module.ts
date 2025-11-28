import { Module } from '@nestjs/common';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';
import { HashPasswordService } from '../hash-password/hash-password.service';
import { EncryptService } from '../encrypt/encrypt.service';

@Module({
  imports: [HashPasswordService, EncryptService],
  controllers: [SignupController],
  providers: [SignupService]
})
export class SignupModule {}
