import { Module } from '@nestjs/common';
import { HashPasswordService } from './hash-password.service';
import { SigninEncryptService } from './signin-encrypt.service';

@Module({
  providers: [HashPasswordService, SigninEncryptService],
  exports: [HashPasswordService, SigninEncryptService],
})
export class HashPasswordModule {}
