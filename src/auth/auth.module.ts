import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HashPasswordModule } from '../hash-password/hash-password.module';
import { SignupModule } from '../signup/signup.module';
import { HttpModule } from '@nestjs/axios';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [HashPasswordModule, SignupModule, HttpModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard]
})
export class AuthModule {}
