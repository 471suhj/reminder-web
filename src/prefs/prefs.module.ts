import { forwardRef, Module } from '@nestjs/common';
import { PrefsService } from './prefs.service';
import { PrefsController } from './prefs.controller';
import { FilesService } from 'src/files/files.service';

@Module({
  imports: [forwardRef(()=>FilesService)],
  providers: [PrefsService],
  controllers: [PrefsController],
  exports: [PrefsService]
})
export class PrefsModule {}
