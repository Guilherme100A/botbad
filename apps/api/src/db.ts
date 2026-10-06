import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@botbad/db';

let db: NodePgDatabase<typeof schema> | null = null;

export function initDb(connectionString?: string): NodePgDatabase<typeof schema> {
  const pool = new pg.Pool({
    connectionString: connectionString ?? process.env['DATABASE_URL'],
  });
  db = drizzle(pool, { schema });
  return db;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    return initDb();
  }
  return db;
}
