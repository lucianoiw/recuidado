import { BullModule } from '@nestjs/bullmq';
import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { PlanGate } from '../billing/plan-gate.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { validateEnv } from '../config/env.js';
import { DbModule } from '../db/db.module.js';
import { DOSES_QUEUE } from '../doses/doses.queue.js';
import { DosesService } from '../doses/doses.service.js';
import { PushService } from '../push/push.service.js';
import { StockService } from '../stock/stock.service.js';
import { telemetry } from '../telemetry/telemetry.js';
import { VoiceCallService } from '../voice/voice.service.js';
import { DosesProcessor } from './doses.processor.js';

/**
 * The worker process: no HTTP server, no controllers. Only the doses queue and the services its
 * jobs use (reminder push, voice call request, family alert, stock). The same services the API
 * uses, so there is one implementation of each step.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'], validate: validateEnv }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // BullMQ needs a constructed client in native ESM.
        connection: new Redis(config.getOrThrow<string>('REDIS_URL'), { maxRetriesPerRequest: null }),
      }),
    }),
    BullModule.registerQueue({ name: DOSES_QUEUE }),
    DbModule,
  ],
  providers: [DosesProcessor, DosesService, VoiceCallService, PushService, AlertsService, StockService, PlanGate],
})
export class WorkerModule implements OnApplicationShutdown {
  /** Sends buffered events and logs before the container stops. */
  async onApplicationShutdown() {
    await telemetry.shutdown();
  }
}
