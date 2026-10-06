import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

/** Applies the SQL migrations generated in packages/db/drizzle (copied next to the bundle in production). */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, 'drizzle'), resolve(here, '../../../../packages/db/drizzle')];
  const migrationsFolder = candidates.find(p => existsSync(p));
  if (!migrationsFolder) throw new Error(`Migrations folder not found (looked in ${candidates.join(', ')})`);

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('[migrate] up to date'))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
