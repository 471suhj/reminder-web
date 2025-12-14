import { forwardRef, Module } from '@nestjs/common';
import { PrefsService } from './prefs.service';
import { PrefsController } from './prefs.controller';
import { FilesModule } from 'src/files/files.module';

@Module({
  imports: [forwardRef(()=>FilesModule)],
  providers: [PrefsService],
  controllers: [PrefsController],
  exports: [PrefsService]
})
export class PrefsModule {}
