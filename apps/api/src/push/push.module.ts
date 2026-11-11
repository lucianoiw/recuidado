import { Module } from '@nestjs/common';
import { PushController } from './push.controller.js';
import { PushService } from '@recuidado/core';

@Module({
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
