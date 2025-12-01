import { Test, TestingModule } from '@nestjs/testing';
import { PrefsController } from './prefs.controller';

describe('PrefsController', () => {
  let controller: PrefsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrefsController],
    }).compile();

    controller = module.get<PrefsController>(PrefsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
