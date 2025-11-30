import { Test, TestingModule } from '@nestjs/testing';
import { DeleteExpiredService } from './delete-expired.service';

describe('DeleteExpiredService', () => {
  let service: DeleteExpiredService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeleteExpiredService],
    }).compile();

    service = module.get<DeleteExpiredService>(DeleteExpiredService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
