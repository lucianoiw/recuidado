import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { corsOrigins } from './cors.js';
import { runMigrations } from './db/migrate.js';
import { wipeCallsIfAsked, wipeIfAsked } from './db/wipe.js';
import { accessLog } from './telemetry/access-log.middleware.js';
import { TelemetryExceptionFilter } from './telemetry/exception.filter.js';
import { telemetry, TelemetryLogger } from '@recuidado/core';

async function bootstrap() {
  // Only the API migrates; the worker never touches the schema.
  if (process.env.DATABASE_URL) {
    await runMigrations(process.env.DATABASE_URL);
    // "Conta zero": empties the database once per WIPE_DATA_ON_BOOT label, before the demo seed runs.
    if (process.env.REDIS_URL) {
      await wipeIfAsked(process.env.DATABASE_URL, process.env.REDIS_URL, process.env.WIPE_DATA_ON_BOOT);
      // A clean calls panel to measure a new version of the calls.
      await wipeCallsIfAsked(process.env.DATABASE_URL, process.env.REDIS_URL, process.env.WIPE_CALLS_ON_BOOT);
    }
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new TelemetryLogger(telemetry),
  });
  // Traefik (Coolify) sits in front: the client IP is in X-Forwarded-For. Used by the prescription read limits.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  // Security headers. The API only serves JSON to the web app on another origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: corsOrigins(process.env.WEB_URL) });
  app.use(accessLog(telemetry));
  app.useGlobalFilters(new TelemetryExceptionFilter(app.getHttpAdapter()));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
  telemetry.capture('service_started', { telemetry: telemetry.enabled });
}

try {
  await bootstrap();
} catch (error) {
  // A failed boot (bad env, migration) is the error that hides best in Coolify.
  telemetry.captureException(error, { phase: 'boot' });
  telemetry.error(`API failed to start: ${String(error)}`);
  await telemetry.shutdown();
  process.exit(1);
}
