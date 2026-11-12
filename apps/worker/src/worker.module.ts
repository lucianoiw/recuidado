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
  PROGRAMS_QUEUE,
  ProgramsService,
  PushService,
  RotationService,
  StockService,
  telemetry,
  validateEnv,
  VoiceCallService,
} from '@recuidado/core';
import { DosesProcessor } from './doses.processor.js';
import { ProgramsProcessor } from './programs.processor.js';

/**
 * The worker process: no HTTP server, no controllers. The doses queue, the monthly refresh of the
 * free-medicine programs, and the services their jobs use (reminder push, voice call request, family alert, stock). The same services the API
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
    BullModule.registerQueue({ name: DOSES_QUEUE }, { name: PROGRAMS_QUEUE }),
    DbModule,
  ],
  providers: [DosesProcessor, ProgramsProcessor, ProgramsService, DosesService, VoiceCallService, PushService, EmailService, AlertsService, StockService, PlanGate, RotationService],
})
export class WorkerModule implements OnApplicationShutdown {
  /** Sends buffered events and logs before the container stops. */
  async onApplicationShutdown() {
    await telemetry.shutdown();
  }
}
