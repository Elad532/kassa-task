import { Injectable } from '@nestjs/common';
import { Dummy } from '@kassa-task/common';

@Injectable()
export class AppService {
  getHello(): Dummy {
    return { id: '1', message: 'hello world' };
  }
}
