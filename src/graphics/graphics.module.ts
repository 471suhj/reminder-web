import { Module } from '@nestjs/common';
import { GraphicsController } from './graphics.controller';

@Module({
  controllers: [GraphicsController]
})
export class GraphicsModule {}
