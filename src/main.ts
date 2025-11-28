import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';
import { readFileSync } from 'fs';
import { ValidationPipe } from '@nestjs/common';
import { HeaderInterceptor } from './header/header.interceptor';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const httpsOptions = {
    pfx: readFileSync('test_cert.pfx'),
    passphrase: process.env.PFX_PASS, // passed from pfx_pass.env as written in package.json
  };

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions,
  });

  app.useStaticAssets(path.join(__dirname, '..', 'public'));
  app.setBaseViewsDir(path.join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new HeaderInterceptor());
  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
