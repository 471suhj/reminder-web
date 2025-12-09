import { Module } from '@nestjs/common';
import { CheckIntegrityService } from './check-integrity.service';

@Module({
  providers: [CheckIntegrityService]
})
export class CheckIntegrityModule {}
