import { Module } from '@nestjs/common';
import { DeleteExpiredService } from './delete-expired.service';

@Module({
  providers: [DeleteExpiredService]
})
export class DeleteExpiredModule {}
