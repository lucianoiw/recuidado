import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { corsOrigins } from './cors.js';
import { runMigrations } from './db/migrate.js';
import { accessLog } from './telemetry/access-log.middleware.js';
import { TelemetryExceptionFilter } from './telemetry/exception.filter.js';
import { TelemetryLogger } from './telemetry/telemetry.logger.js';
import { telemetry } from './telemetry/telemetry.js';

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    await runMigrations(process.env.DATABASE_URL);
  }
  const app = await NestFactory.create(AppModule, {
    logger: new TelemetryLogger(telemetry),
  });
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
