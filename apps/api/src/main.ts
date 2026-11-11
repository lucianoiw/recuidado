import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { runMigrations } from './db/migrate.js';

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    await runMigrations(process.env.DATABASE_URL);
  }
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:3000' });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
}
await bootstrap();
