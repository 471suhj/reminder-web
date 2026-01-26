import { forwardRef, Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { PrefsModule } from 'src/prefs/prefs.module';
import { FileUtilsService } from './file-utils.service';
import { FileResolutionService } from './file-resolution.service';

@Module({
    imports: [forwardRef(()=>PrefsModule)],
    controllers: [FilesController],
    providers: [FilesService, FileUtilsService, FileResolutionService],
    exports: [FilesService, FileUtilsService, FileResolutionService],
})
export class FilesModule {}
