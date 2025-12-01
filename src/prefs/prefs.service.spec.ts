import { Test, TestingModule } from '@nestjs/testing';
import { PrefsService } from './prefs.service';

describe('PrefsService', () => {
  let service: PrefsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrefsService],
    }).compile();

    service = module.get<PrefsService>(PrefsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
