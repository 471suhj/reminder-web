import { Module } from '@nestjs/common';
import { PrefsService } from './prefs.service';
import { PrefsController } from './prefs.controller';

@Module({
  providers: [PrefsService],
  controllers: [PrefsController],
  exports: [PrefsService]
})
export class PrefsModule {}
