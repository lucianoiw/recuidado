import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { Pool } from 'pg';

// Applies pending SQL migrations from ./drizzle. Runs on boot so a fresh
// deploy on Coolify comes up with the schema in place.
export async function runMigrations(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: join(import.meta.dirname, '..', '..', 'drizzle'),
    });
  } finally {
    await pool.end();
  }
}
