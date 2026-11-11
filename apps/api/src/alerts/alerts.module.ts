import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { PushModule } from '../push/push.module.js';
import { AlertsService } from '@recuidado/core';

@Module({
  imports: [PushModule, EmailModule],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
