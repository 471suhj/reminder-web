import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MysqlModule } from './mysql/mysql.module';

@Module({
  imports: [AuthModule, MysqlModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
