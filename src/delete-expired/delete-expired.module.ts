import { Module } from '@nestjs/common';
import { DeleteExpiredService } from './delete-expired.service';
import { FilesModule } from 'src/files/files.module';

@Module({
  imports: [FilesModule],
  providers: [DeleteExpiredService]
})
export class DeleteExpiredModule {}
