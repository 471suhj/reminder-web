import { forwardRef, Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { PrefsModule } from 'src/prefs/prefs.module';

@Module({
  imports: [forwardRef(()=>PrefsModule)],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService]
})
export class FilesModule {}
