import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { decisionEvents, memberships, tenants, users } from '@botbad/db';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { getConfig } from '../config.js';
import { getJevAdapter, getThresholds, POLICY_VERSION, PROFILE_VERSION } from '../decision/pipeline.js';
import { jevCircuitBreaker } from '../decision/circuit-breaker.js';
import { DEFAULT_BUDGET } from '../decision/budget.js';
import { DEFAULT_TENANT_LIMITS } from '../decision/rate-limiter.js';

// Read-only views the panel needs. Every query is scoped to the caller's tenant.

const MODEL_BY_ADAPTER = { real: 'jev-1.13.0', openrouter: 'typesafe/jev-router', mock: 'mock' } as const;
const DEFAULT_TIMEOUT_BY_ADAPTER = { real: 600, openrouter: 15_000, mock: 0 } as const;

// healthCheck may hit the provider: cache it so opening the panel doesn't spend calls.
let health: { ok: boolean; at: number } | null = null;
async function engineHealthy(): Promise<boolean> {
  if (health && Date.now() - health.at < 30_000) return health.ok;
  const adapter = getJevAdapter();
  let ok = false;
  if (adapter) {
    ok = await Promise.race([
      adapter.healthCheck().catch(() => false),
      new Promise<boolean>(res => setTimeout(() => res(false), 2000)),
    ]);
  }
  health = { ok, at: Date.now() };
  return ok;
}

async function budgetUsage(tenantId: string) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay);
  startOfMonth.setUTCDate(1);
  const res = await getDb().execute<{ daily: string; monthly: string }>(sql`
    SELECT
      coalesce(sum(tokens_reserved) FILTER (WHERE reserved_at >= ${startOfDay}), 0) AS daily,
      coalesce(sum(tokens_reserved), 0) AS monthly
    FROM budget_reservations
    WHERE tenant_id = ${tenantId} AND reserved_at >= ${startOfMonth} AND status <> 'released'
  `);
  return { daily: Number(res.rows[0]?.daily ?? 0), monthly: Number(res.rows[0]?.monthly ?? 0) };
}

// ── /engine ──

export const engineRoutes = new Hono();
engineRoutes.use('*', authMiddleware);

engineRoutes.get('/status', async (c) => {
  const auth = c.get('auth');
  const config = getConfig();
  const [healthy, usage] = await Promise.all([engineHealthy(), budgetUsage(auth.tenantId)]);
  return c.json({
    adapter: config.jevAdapter,
    model: MODEL_BY_ADAPTER[config.jevAdapter],
    healthy,
    circuit: jevCircuitBreaker.getState(),
    // No campaign mode yet: every campaign acts on decisions (shadow mode is pending, see README).
    mode: 'active',
    policyVersion: POLICY_VERSION,
    profileVersion: PROFILE_VERSION,
    timeoutMs: config.jevTimeoutMs ?? DEFAULT_TIMEOUT_BY_ADAPTER[config.jevAdapter],
    thresholds: getThresholds(),
    budget: {
      usedToday: usage.daily,
      usedMonth: usage.monthly,
      dailyLimit: DEFAULT_BUDGET.dailyTokenLimit,
      monthlyLimit: DEFAULT_BUDGET.monthlyTokenLimit,
    },
    checkedAt: new Date(health?.at ?? Date.now()).toISOString(),
  });
});

// ── /metrics ──

export const metricsRoutes = new Hono();
metricsRoutes.use('*', authMiddleware);

metricsRoutes.get('/summary', async (c) => {
  const auth = c.get('auth');
  const days = z.coerce.number().int().min(1).max(90).catch(30).parse(c.req.query('days'));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await getDb().execute<Record<string, string | null>>(sql`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE action = 'route_primary') AS route_primary,
      count(*) FILTER (WHERE action = 'route_alternative') AS route_alternative,
      count(*) FILTER (WHERE action = 'challenge') AS challenge,
      count(*) FILTER (WHERE action = 'deny') AS deny,
      count(*) FILTER (WHERE source = 'rule') AS src_rule,
      count(*) FILTER (WHERE source = 'cache') AS src_cache,
      count(*) FILTER (WHERE source = 'jev') AS src_jev,
      count(*) FILTER (WHERE source = 'fallback') AS src_fallback,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95
    FROM decision_events
    WHERE tenant_id = ${auth.tenantId} AND timestamp >= ${since}
  `);
  const r = res.rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  return c.json({
    days,
    totalAccesses: n('total'),
    routePrimary: n('route_primary'),
    routeAlternative: n('route_alternative'),
    challenge: n('challenge'),
    deny: n('deny'),
    latencyP95Ms: r['p95'] == null ? null : Math.round(Number(r['p95'])),
    decisionSources: { rule: n('src_rule'), cache: n('src_cache'), jev: n('src_jev'), fallback: n('src_fallback') },
  });
});

// ── /events (whole tenant; the per-campaign list stays at /campaigns/:id/events) ──

export const tenantEventRoutes = new Hono();
tenantEventRoutes.use('*', authMiddleware);

tenantEventRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const parsed = z.object({
    cursor: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }).safeParse({ cursor: c.req.query('cursor'), limit: c.req.query('limit') });
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Invalid pagination params' }, 400);
  }
  const { cursor, limit } = parsed.data;
  const where = cursor
    ? and(eq(decisionEvents.tenantId, auth.tenantId), lt(decisionEvents.timestamp, new Date(cursor)))
    : eq(decisionEvents.tenantId, auth.tenantId);
  const rows = await getDb().select().from(decisionEvents).where(where)
    .orderBy(desc(decisionEvents.timestamp)).limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({
    items,
    pagination: { hasMore, nextCursor: hasMore ? items[items.length - 1]!.timestamp.toISOString() : null },
  });
});

// ── /tenant ──

export const tenantRoutes = new Hono();
tenantRoutes.use('*', authMiddleware);

tenantRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, auth.tenantId));
  if (!tenant) return c.json({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
  const members = await db
    .select({ id: memberships.id, userId: memberships.userId, email: users.email, name: users.name, role: memberships.role, createdAt: memberships.createdAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.tenantId, auth.tenantId))
    .orderBy(memberships.createdAt);
  return c.json({
    tenant,
    members,
    limits: {
      requestsPerDay: DEFAULT_TENANT_LIMITS.maxPerDay,
      requestsPerMonth: DEFAULT_TENANT_LIMITS.maxPerMonth,
      requestsPerMinutePerVisitor: Number(process.env['RATE_LIMIT_PER_IP_PER_MIN'] ?? 120),
      jevTokensPerDay: DEFAULT_BUDGET.dailyTokenLimit,
      jevTokensPerMonth: DEFAULT_BUDGET.monthlyTokenLimit,
    },
  });
});
