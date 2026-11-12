import { BullModule } from '@nestjs/bullmq';
import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import {
  AlertsService,
  DbModule,
  DOSES_QUEUE,
  DosesService,
  EmailService,
  PlanGate,
  PushService,
  RotationService,
  StockService,
  telemetry,
  validateEnv,
  VoiceCallService,
} from '@recuidado/core';
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
  providers: [DosesProcessor, DosesService, VoiceCallService, PushService, EmailService, AlertsService, StockService, PlanGate, RotationService],
})
export class WorkerModule implements OnApplicationShutdown {
  /** Sends buffered events and logs before the container stops. */
  async onApplicationShutdown() {
    await telemetry.shutdown();
  }
}
