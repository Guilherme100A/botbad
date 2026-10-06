import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@botbad/db';
import { FIXTURE_TENANT } from '@botbad/contracts';
import { hashPassword } from '../auth/password.js';

/** The tenant the contracts fixtures and the web app already use. */
export const DEFAULT_TENANT_ID = FIXTURE_TENANT.id;

export interface SeedOptions {
  databaseUrl: string;
  adminEmail: string;
  adminPassword: string;
  tenantName?: string;
  /** Adds two destinations and an active demo campaign at /r/demo. */
  demo?: boolean;
}

/** Idempotent: re-running keeps existing rows and only fills what is missing. */
export async function seed(opts: SeedOptions): Promise<{ tenantId: string; userId: string; created: boolean }> {
  const pool = new pg.Pool({ connectionString: opts.databaseUrl });
  const db = drizzle(pool, { schema });
  try {
    await db.insert(schema.tenants)
      .values({ id: DEFAULT_TENANT_ID, name: opts.tenantName ?? 'Organização padrão' })
      .onConflictDoNothing();

    const email = opts.adminEmail.trim().toLowerCase();
    let [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    let created = false;
    if (!user) {
      [user] = await db.insert(schema.users)
        .values({ email, name: 'Administrador', passwordHash: await hashPassword(opts.adminPassword) })
        .returning();
      created = true;
    }

    await db.insert(schema.memberships)
      .values({ tenantId: DEFAULT_TENANT_ID, userId: user!.id, role: 'owner' })
      .onConflictDoNothing();

    if (opts.demo) {
      const [existing] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.slug, 'demo'));
      if (!existing) {
        const [primary] = await db.insert(schema.destinations)
          .values({ tenantId: DEFAULT_TENANT_ID, url: 'https://example.com/', label: 'Demo — principal' })
          .returning();
        const [alternative] = await db.insert(schema.destinations)
          .values({ tenantId: DEFAULT_TENANT_ID, url: 'https://example.org/', label: 'Demo — alternativa' })
          .returning();
        await db.insert(schema.campaigns).values({
          tenantId: DEFAULT_TENANT_ID,
          name: 'Campanha demo',
          slug: 'demo',
          primaryDestinationId: primary!.id,
          alternativeDestinationId: alternative!.id,
          status: 'active',
        });
      }
    }

    return { tenantId: DEFAULT_TENANT_ID, userId: user!.id, created };
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const env = process.env;
  const isProduction = env['NODE_ENV'] === 'production';
  const databaseUrl = env['DATABASE_URL'];
  let adminPassword = env['SEED_ADMIN_PASSWORD'];
  const adminEmail = env['SEED_ADMIN_EMAIL'] ?? (isProduction ? undefined : 'admin@jev.local');

  if (!databaseUrl || !adminEmail || (isProduction && !adminPassword)) {
    console.error('Required: DATABASE_URL, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (email/password have dev defaults only)');
    process.exit(1);
  }
  const generated = !adminPassword;
  adminPassword ??= randomBytes(9).toString('base64url');

  seed({ databaseUrl, adminEmail, adminPassword, demo: env['SEED_DEMO'] === '1' })
    .then(({ created }) => {
      if (created) {
        console.log(`[seed] owner created: ${adminEmail}${generated ? `  password: ${adminPassword}` : ''}`);
      } else {
        console.log(`[seed] owner ${adminEmail} already exists (password unchanged)`);
      }
    })
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
