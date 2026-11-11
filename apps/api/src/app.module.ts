import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { DosesModule } from './doses/doses.module.js';
import { HealthController } from './health/health.controller.js';
import { PrescriptionsModule } from './prescriptions/prescriptions.module.js';
import { VoiceModule } from './voice/voice.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // BullMQ needs a constructed client in native ESM.
        connection: new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    DbModule,
    DosesModule,
    PrescriptionsModule,
    VoiceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
