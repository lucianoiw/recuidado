import { writeFileSync } from 'node:fs';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { telemetry, TelemetryLogger } from '@recuidado/core';
import { WorkerModule } from './worker.module.js';

/** Touched every 30 s; the Docker health check fails when it gets old (the process is stuck or gone). */
export const HEARTBEAT_FILE = '/tmp/worker-heartbeat';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: new TelemetryLogger(telemetry) });
  app.enableShutdownHooks();
  const beat = () => writeFileSync(HEARTBEAT_FILE, new Date().toISOString());
  beat();
  setInterval(beat, 30_000).unref();
  telemetry.capture('service_started', { telemetry: telemetry.enabled });
}

try {
  await bootstrap();
} catch (error) {
  telemetry.captureException(error, { phase: 'boot' });
  telemetry.error(`Worker failed to start: ${String(error)}`);
  await telemetry.shutdown();
  process.exit(1);
}
