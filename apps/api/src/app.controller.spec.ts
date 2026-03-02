import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(() => {
    controller = new AppController(new AppService());
  });

  it('should return hello world payload', () => {
    const result = controller.getHello();
    expect(result).toEqual({ id: '1', message: 'hello world' });
  });
});
