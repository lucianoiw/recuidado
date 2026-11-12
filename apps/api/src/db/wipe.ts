import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { DOSES_QUEUE, telemetry } from '@recuidado/core';

const MARKER = 'recuidado:wipe:';

/**
 * Wipes every row of the database once, on boot, to start the demo from a "conta zero".
 * Runs only when WIPE_DATA_ON_BOOT is set; its value is a label (e.g. "2026-11-12") and each label wipes once:
 * a Redis marker remembers it, so later boots and redeploys keep the data. Afterwards the boot seeds the demo
 * family again (DEMO_SEED_ENABLED). The schema and the migrations table stay. Doses queue jobs are removed too,
 * so restart the worker after it, which schedules the hourly planner again.
 * Call recordings and box photos in R2 are not deleted (their rows are gone, so nothing shows them).
 */
export async function wipeIfAsked(databaseUrl: string, redisUrl: string, label: string | undefined): Promise<boolean> {
  const tag = label?.trim();
  if (!tag) return false;
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  try {
    if (await redis.get(MARKER + tag)) return false;
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const { rows } = await pool.query<{ name: string }>(
        `select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`,
      );
      if (rows.length > 0) {
        await pool.query(`truncate table ${rows.map((r) => r.name).join(', ')} restart identity cascade`);
      }
    } finally {
      await pool.end();
    }
    const queue = new Queue(DOSES_QUEUE, { connection: redis });
    await queue.obliterate({ force: true });
    await queue.close();
    await redis.set(MARKER + tag, new Date().toISOString());
    telemetry.warn(`Database wiped on boot (WIPE_DATA_ON_BOOT=${tag}).`);
    return true;
  } finally {
    redis.disconnect();
  }
}
