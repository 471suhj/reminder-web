import { Test, TestingModule } from '@nestjs/testing';
import { CheckIntegrityService } from './check-integrity.service';

describe('CheckIntegrityService', () => {
  let service: CheckIntegrityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CheckIntegrityService],
    }).compile();

    service = module.get<CheckIntegrityService>(CheckIntegrityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
