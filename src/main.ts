import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';
import { readFileSync } from 'fs';
import cookieParser from 'cookie-parser';
import { headerMiddleware } from './header/header.middleware';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {

  process.on('unhandledRejection', (reason, promise)=>{
    console.log('unhandledRejection: ', reason);
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(path.join(__dirname, '..', 'public'));
  app.setBaseViewsDir(path.join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  //app.useGlobalPipes(new ValidationPipe());
  //app.useGlobalInterceptors(new HeaderInterceptor());
  app.use(cookieParser());
  app.use(headerMiddleware);
  //app.useGlobalGuards(new AuthGuard());

  const config = new DocumentBuilder()
    .setTitle('ComphyCat Reminder Online')
    .setDescription('API Specifications for ComphyCat Reminder Online')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
