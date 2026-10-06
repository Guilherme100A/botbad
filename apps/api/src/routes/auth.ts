import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getConnInfo } from '@hono/node-server/conninfo';
import { memberships, tenants, users } from '@botbad/db';
import { authMiddleware, signJwt } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { getDb } from '../db.js';

const loginInput = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(256),
  /** Pick a tenant when the user belongs to several; defaults to the oldest membership. */
  tenantId: z.string().uuid().optional(),
});

// Brute-force guard: per (email, client) pair, in memory. Enough for a single API instance.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count++;
  if (attempts.size > 10_000) {
    for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
  }
}

export function resetLoginAttemptsForTesting(): void {
  attempts.clear();
}

// Verifying against a throwaway hash keeps "unknown email" as slow as "wrong password".
let dummyHash: Promise<string> | null = null;

const INVALID = { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' } as const;

const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginInput.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Informe e-mail e senha.' }, 400);
  }
  const { email, password, tenantId } = parsed.data;

  let client = '';
  try { client = getConnInfo(c).remote.address ?? ''; } catch { /* not under node server */ }
  const throttleKey = `${email}|${client}`;
  if (tooManyAttempts(throttleKey)) {
    c.header('Retry-After', String(WINDOW_MS / 1000));
    return c.json({ code: 'RATE_LIMIT', message: 'Muitas tentativas. Tente novamente mais tarde.' }, 429);
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  dummyHash ??= hashPassword('not-a-real-password');
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok) {
    recordFailure(throttleKey);
    return c.json(INVALID, 401);
  }

  const rows = await db
    .select({ tenantId: memberships.tenantId, role: memberships.role, tenantName: tenants.name })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(tenantId ? and(eq(memberships.userId, user.id), eq(memberships.tenantId, tenantId)) : eq(memberships.userId, user.id))
    .orderBy(memberships.createdAt);
  const membership = rows[0];
  if (!membership) {
    recordFailure(throttleKey);
    return c.json({ code: 'FORBIDDEN', message: 'Usuário sem acesso a esta organização.' }, 403);
  }

  attempts.delete(throttleKey);
  const token = signJwt({ userId: user.id, tenantId: membership.tenantId, role: membership.role });
  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    tenant: { id: membership.tenantId, name: membership.tenantName },
    role: membership.role,
  });
});

authRoutes.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const db = getDb();
  const [row] = await db
    .select({ email: users.email, name: users.name, tenantName: tenants.name, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(and(eq(memberships.userId, auth.userId), eq(memberships.tenantId, auth.tenantId)));
  // Membership revoked after the token was issued: the token no longer grants anything.
  if (!row) return c.json({ code: 'UNAUTHORIZED', message: 'Acesso revogado.' }, 401);
  return c.json({
    user: { id: auth.userId, email: row.email, name: row.name },
    tenant: { id: auth.tenantId, name: row.tenantName },
    role: row.role,
  });
});

export { authRoutes };
