import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { DEMO_FAMILY, DOSES_QUEUE, telemetry } from '@recuidado/core';

const MARKER = 'recuidado:wipe:';

/**
 * Deletes every family except the demo family once, on boot, to start the demo from a "conta zero".
 * The demo family stays with its call history and recordings (the calls panel the jury sees); everything of the
 * other families goes through the foreign key cascades (members, medicines, doses, calls, alerts, sessions).
 * Login codes go too. Runs only when WIPE_DATA_ON_BOOT is set; its value is a label (e.g. "2026-11-12") and each
 * label wipes once: a Redis marker remembers it, so later boots and redeploys keep the data. Doses queue jobs are
 * removed, so restart the worker after it, which schedules the hourly planner again.
 * Call recordings and box photos of the deleted families stay in R2, but nothing points to them.
 */
export async function wipeIfAsked(databaseUrl: string, redisUrl: string, label: string | undefined): Promise<boolean> {
  const tag = label?.trim();
  if (!tag) return false;
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  try {
    if (await redis.get(MARKER + tag)) return false;
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query('delete from families where name <> $1', [DEMO_FAMILY]);
      await pool.query('delete from login_codes');
    } finally {
      await pool.end();
    }
    const queue = new Queue(DOSES_QUEUE, { connection: redis });
    await queue.obliterate({ force: true });
    await queue.close();
    await redis.set(MARKER + tag, new Date().toISOString());
    telemetry.warn(`Families other than the demo deleted on boot (WIPE_DATA_ON_BOOT=${tag}).`);
    return true;
  } finally {
    redis.disconnect();
  }
}
