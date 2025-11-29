import { HeaderMiddleware } from './header.middleware';

describe('HeaderMiddleware', () => {
  it('should be defined', () => {
    expect(new HeaderMiddleware()).toBeDefined();
  });
});
