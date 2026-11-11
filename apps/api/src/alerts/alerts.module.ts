import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module.js';
import { AlertsService } from './alerts.service.js';

@Module({
  imports: [PushModule],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
