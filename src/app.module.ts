import { Module, ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MysqlModule } from './mysql/mysql.module';
import { APP_PIPE, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthGuard } from './auth/auth.guard';
import { DeleteExpiredModule } from './delete-expired/delete-expired.module';
import { MongoModule } from './mongo/mongo.module';
import { FilesModule } from './files/files.module';
import { HomeModule } from './home/home.module';
import { PrefsModule } from './prefs/prefs.module';

@Module({
  imports: [AuthModule, MysqlModule, 
    ScheduleModule.forRoot(), DeleteExpiredModule, MongoModule, FilesModule, HomeModule, PrefsModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_GUARD, useClass: AuthGuard},
  ],
})
export class AppModule {}
