import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Dummy } from '@kassa-task/common';

@Controller('hello')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): Dummy {
    return this.appService.getHello();
  }
}
