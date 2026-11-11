import { BullModule } from '@nestjs/bullmq';
import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { DemoModule } from './demo/demo.module.js';
import { DosesModule } from './doses/doses.module.js';
import { FamilyModule } from './family/family.module.js';
import { MedicationsModule } from './medications/medications.module.js';
import { HealthController } from './health/health.controller.js';
import { PushModule } from './push/push.module.js';
import { PrescriptionsModule } from './prescriptions/prescriptions.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { VoiceModule } from './voice/voice.module.js';
import { telemetry } from './telemetry/telemetry.js';

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
    // Every route is open (no login): one IP gets RATE_LIMIT_PER_MINUTE requests a minute.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const limit = config.getOrThrow<number>('RATE_LIMIT_PER_MINUTE');
        return {
          throttlers: [{ name: 'minute', ttl: 60_000, limit: limit || Number.MAX_SAFE_INTEGER }],
          errorMessage: 'Muitas requisições em pouco tempo. Espere um minuto e tente de novo.',
        };
      },
    }),
    DbModule,
    DemoModule,
    DosesModule,
    FamilyModule,
    MedicationsModule,
    PushModule,
    PrescriptionsModule,
    PrivacyModule,
    VoiceModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements OnApplicationShutdown {
  /** Sends buffered events and logs before the container stops. */
  async onApplicationShutdown() {
    await telemetry.shutdown();
  }
}
