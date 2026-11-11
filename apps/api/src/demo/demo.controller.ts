import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DemoService } from './demo.service.js';

/** Demo run button on the family app. No login, like the rest of the demo family. */
@Controller('demo/run')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Post()
  @HttpCode(200)
  start() {
    return this.demo.start();
  }

  @Get(':doseId')
  status(@Param('doseId', ParseUUIDPipe) doseId: string) {
    return this.demo.status(doseId);
  }
}
