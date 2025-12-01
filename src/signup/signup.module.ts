import { Module } from '@nestjs/common';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';
import { HashPasswordModule } from '../hash-password/hash-password.module';
import { EncryptModule } from '../encrypt/encrypt.module';

@Module({
  imports: [HashPasswordModule, EncryptModule],
  controllers: [SignupController],
  providers: [SignupService],
  exports: [SignupService]
})
export class SignupModule {}
