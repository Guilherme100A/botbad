import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@botbad/db';
import { getConfig } from './config.js';

export type Db = NodePgDatabase<typeof schema>;

let db: Db | null = null;

export function initDb(connectionString?: string): Db {
  const pool = new pg.Pool({
    connectionString: connectionString ?? getConfig().databaseUrl,
  });
  db = drizzle(pool, { schema });
  return db;
}

export function getDb(): Db {
  if (!db) {
    return initDb();
  }
  return db;
}
