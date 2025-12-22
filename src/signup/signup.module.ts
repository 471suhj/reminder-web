import { forwardRef, Module } from '@nestjs/common';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';
import { HashPasswordModule } from '../hash-password/hash-password.module';
import { EncryptModule } from '../encrypt/encrypt.module';
import { FilesModule } from 'src/files/files.module';
import { AwsModule } from 'src/aws/aws.module';

@Module({
  imports: [HashPasswordModule, EncryptModule, HashPasswordModule, forwardRef(()=>FilesModule), AwsModule],
  controllers: [SignupController],
  providers: [SignupService],
  exports: [SignupService]
})
export class SignupModule {}
