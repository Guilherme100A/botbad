/**
 * API + Postgres integration tests: auth, tenant isolation, RBAC, destination rules,
 * the real /r/:slug flow (DB, budget, events), budget concurrency, per-IP limit, CORS.
 *
 * Needs a reachable Postgres. TEST_DATABASE_URL points at any database on that server;
 * the suite (re)creates its own `botbad_test` database there.
 *   TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres npm test
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from '@botbad/db';
import { createMockJevAssessment } from '@botbad/contracts';
import { loadConfig, setConfigForTesting } from '../../apps/api/src/config.js';
import { initDb, getDb } from '../../apps/api/src/db.js';
import { runMigrations } from '../../apps/api/src/scripts/migrate.js';
import { seed, DEFAULT_TENANT_ID } from '../../apps/api/src/scripts/seed.js';
import { hashPassword } from '../../apps/api/src/auth/password.js';
import { resetLoginAttemptsForTesting } from '../../apps/api/src/routes/auth.js';
import { setJevAdapter, applyPolicy } from '../../apps/api/src/decision/pipeline.js';
import { reserveBudget } from '../../apps/api/src/decision/budget.js';
import { resetForTesting as resetRateLimiter } from '../../apps/api/src/decision/rate-limiter.js';
import { jevCircuitBreaker } from '../../apps/api/src/decision/circuit-breaker.js';
import { JevMockAdapter } from '../../apps/api/src/adapters/jev-mock.js';

const BASE = process.env['TEST_DATABASE_URL'];
const skip = BASE ? false : 'TEST_DATABASE_URL not set';

const ADMIN = { email: 'owner@test.local', password: 'correct horse battery staple' };

let app: typeof import('../../apps/api/src/index.js').default;
let pool: pg.Pool;

function testDbUrl(base: string, name: string): string {
  const u = new URL(base);
  u.pathname = `/${name}`;
  return u.toString();
}

async function call(method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await app.fetch(new Request(`http://router.test${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }));
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* redirects / plain text */ }
  return { status: res.status, json, headers: res.headers, text };
}

async function loginAs(email: string, password: string): Promise<string> {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}: ${r.text}`);
  return r.json.token;
}

async function createCampaign(token: string, name: string, primary = 'https://shop.example.com/offer', alternative = 'https://shop.example.com/safe') {
  const p = await call('POST', '/destinations', { token, body: { url: primary, label: `${name} P` } });
  const a = await call('POST', '/destinations', { token, body: { url: alternative, label: `${name} A` } });
  assert.equal(p.status, 201, p.text);
  assert.equal(a.status, 201, a.text);
  const c = await call('POST', '/campaigns', {
    token,
    body: { name, primaryDestinationId: p.json.id, alternativeDestinationId: a.json.id },
  });
  assert.equal(c.status, 201, c.text);
  return { campaign: c.json, primary: p.json, alternative: a.json };
}

describe('API + Postgres', { skip }, () => {
  before(async () => {
    const admin = new pg.Client({ connectionString: BASE });
    await admin.connect();
    await admin.query('DROP DATABASE IF EXISTS botbad_test WITH (FORCE)');
    await admin.query('CREATE DATABASE botbad_test');
    await admin.end();

    const url = testDbUrl(BASE!, 'botbad_test');
    setConfigForTesting(loadConfig({ NODE_ENV: 'test', DATABASE_URL: url, JWT_SECRET: 'x'.repeat(48), JEV_ADAPTER: 'mock' }));
    await runMigrations(url);
    await seed({ databaseUrl: url, adminEmail: ADMIN.email, adminPassword: ADMIN.password });
    initDb(url);
    pool = new pg.Pool({ connectionString: url });
    setJevAdapter(new JevMockAdapter());
    app = (await import('../../apps/api/src/index.js')).default;
  });

  after(async () => {
    await pool?.end();
    await (getDb() as any).$client?.end?.();
  });

  beforeEach(() => {
    resetLoginAttemptsForTesting();
    resetRateLimiter();
    jevCircuitBreaker.resetForTesting();
  });

  describe('login', () => {
    it('accepts the seeded owner and returns tenant + role', async () => {
      const r = await call('POST', '/auth/login', { body: ADMIN });
      assert.equal(r.status, 200);
      assert.equal(r.json.role, 'owner');
      assert.equal(r.json.tenant.id, DEFAULT_TENANT_ID);
      assert.ok(r.json.token.split('.').length === 3);
    });

    it('answers wrong password and unknown e-mail identically', async () => {
      const wrong = await call('POST', '/auth/login', { body: { email: ADMIN.email, password: 'nope' } });
      const unknown = await call('POST', '/auth/login', { body: { email: 'ghost@test.local', password: 'nope' } });
      assert.equal(wrong.status, 401);
      assert.equal(unknown.status, 401);
      assert.deepEqual(wrong.json, unknown.json);
    });

    it('no longer issues tokens from client-chosen ids/roles', async () => {
      const r = await call('POST', '/auth/login', {
        body: { userId: '00000000-0000-4000-a000-000000000001', tenantId: DEFAULT_TENANT_ID, role: 'owner' },
      });
      assert.equal(r.status, 400);
    });

    it('locks out after repeated failures', async () => {
      for (let i = 0; i < 10; i++) {
        await call('POST', '/auth/login', { body: { email: ADMIN.email, password: `bad-${i}` } });
      }
      const r = await call('POST', '/auth/login', { body: ADMIN });
      assert.equal(r.status, 429);
    });

    it('/auth/me reflects the token', async () => {
      const token = await loginAs(ADMIN.email, ADMIN.password);
      const r = await call('GET', '/auth/me', { token });
      assert.equal(r.status, 200);
      assert.equal(r.json.user.email, ADMIN.email);
    });
  });

  describe('tokens', () => {
    it('rejects a tampered token', async () => {
      const token = await loginAs(ADMIN.email, ADMIN.password);
      const [h, , s] = token.split('.');
      const forged = Buffer.from(JSON.stringify({ userId: 'x', tenantId: DEFAULT_TENANT_ID, role: 'owner', exp: 9e9 })).toString('base64url');
      assert.equal((await call('GET', '/campaigns', { token: `${h}.${forged}.${s}` })).status, 401);
    });

    it('rejects a token without exp even if correctly signed', async () => {
      const { createHmac } = await import('node:crypto');
      const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ userId: 'u', tenantId: DEFAULT_TENANT_ID, role: 'owner' })).toString('base64url');
      const sig = createHmac('sha256', 'x'.repeat(48)).update(`${head}.${body}`).digest('base64url');
      assert.equal((await call('GET', '/campaigns', { token: `${head}.${body}.${sig}` })).status, 401);
    });
  });

  describe('tenant isolation and roles', () => {
    let ownerToken: string;
    let otherToken: string;
    let viewerToken: string;
    let ownerCampaignId: string;

    before(async () => {
      const db = getDb();
      const [other] = await db.insert(schema.tenants).values({ name: 'Outra org' }).returning();
      const [otherUser] = await db.insert(schema.users).values({ email: 'other@test.local', passwordHash: await hashPassword('pw-other-123') }).returning();
      await db.insert(schema.memberships).values({ tenantId: other!.id, userId: otherUser!.id, role: 'owner' });
      const [viewer] = await db.insert(schema.users).values({ email: 'viewer@test.local', passwordHash: await hashPassword('pw-viewer-123') }).returning();
      await db.insert(schema.memberships).values({ tenantId: DEFAULT_TENANT_ID, userId: viewer!.id, role: 'viewer' });

      ownerToken = await loginAs(ADMIN.email, ADMIN.password);
      otherToken = await loginAs('other@test.local', 'pw-other-123');
      viewerToken = await loginAs('viewer@test.local', 'pw-viewer-123');
      ownerCampaignId = (await createCampaign(ownerToken, 'Isolada')).campaign.id;
    });

    it("another tenant cannot read or change this tenant's campaign", async () => {
      assert.equal((await call('GET', `/campaigns/${ownerCampaignId}`, { token: otherToken })).status, 404);
      assert.equal((await call('POST', `/campaigns/${ownerCampaignId}/activate`, { token: otherToken })).status, 404);
      const list = await call('GET', '/campaigns', { token: otherToken });
      assert.ok(!list.json.items.some((c: any) => c.id === ownerCampaignId));
    });

    it('a viewer can read but not create', async () => {
      assert.equal((await call('GET', '/campaigns', { token: viewerToken })).status, 200);
      const r = await call('POST', '/destinations', { token: viewerToken, body: { url: 'https://example.com/', label: 'x' } });
      assert.equal(r.status, 403);
    });
  });

  describe('destination rules', () => {
    let token: string;
    before(async () => { token = await loginAs(ADMIN.email, ADMIN.password); });

    for (const url of [
      'http://example.com/',
      'https://localhost/',
      'https://10.0.0.5/',
      'https://192.168.1.1/x',
      'https://[::1]/',
      'https://user:pass@example.com/',
      'https://intranet/',
      'https://printer.local/',
    ]) {
      it(`rejects ${url}`, async () => {
        const r = await call('POST', '/destinations', { token, body: { url, label: 'bad' } });
        assert.equal(r.status, 400, r.text);
      });
    }

    it('accepts a public https URL', async () => {
      const r = await call('POST', '/destinations', { token, body: { url: 'https://www.example.com/landing?utm=1', label: 'ok' } });
      assert.equal(r.status, 201);
    });
  });

  describe('router /r/:slug end to end', () => {
    let token: string;
    before(async () => { token = await loginAs(ADMIN.email, ADMIN.password); });

    it('likely human reaches the primary, through the real budget and event recording', async () => {
      const { campaign, primary } = await createCampaign(token, 'Fluxo real');
      const act = await call('POST', `/campaigns/${campaign.id}/activate`, { token });
      assert.equal(act.status, 200, act.text);
      const slug = act.json.slug as string;

      const before = await pool.query('SELECT count(*)::int AS n FROM budget_reservations');
      const r = await call('GET', `/r/${slug}`, {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/126', accept: 'text/html', 'accept-language': 'pt-BR' },
      });
      assert.equal(r.status, 302, r.text);
      assert.equal(r.headers.get('location'), primary.url);
      assert.ok(r.headers.get('x-decision-id'), 'decision id is exposed outside production');

      // Regression: reservations used to fail on the driver's result shape, sending everyone to the alternative.
      const after = await pool.query("SELECT count(*)::int AS n FROM budget_reservations WHERE status = 'used'");
      assert.equal(after.rows[0].n, before.rows[0].n + 1);

      await new Promise(res => setTimeout(res, 200)); // events are written fire-and-forget
      const events = await pool.query('SELECT reason_code FROM decision_events WHERE campaign_id = $1', [campaign.id]);
      assert.deepEqual(events.rows.map(e => e.reason_code), ['JEV_HUMAN_PRIMARY']);
    });

    it('activation is recorded in the audit log', async () => {
      const rows = await getDb().select().from(schema.auditLog).where(eq(schema.auditLog.action, 'campaign.activate'));
      assert.ok(rows.length >= 1);
    });

    it('unknown slug is 404', async () => {
      assert.equal((await call('GET', '/r/does-not-exist')).status, 404);
    });

    it('per-visitor limit answers 429 past the threshold', async () => {
      process.env['RATE_LIMIT_PER_IP_PER_MIN'] = '3';
      try {
        const { campaign } = await createCampaign(token, 'Volume');
        const slug = (await call('POST', `/campaigns/${campaign.id}/activate`, { token })).json.slug;
        const codes: number[] = [];
        for (let i = 0; i < 4; i++) codes.push((await call('GET', `/r/${slug}`, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' } })).status);
        assert.deepEqual(codes, [302, 302, 302, 429]);
      } finally {
        delete process.env['RATE_LIMIT_PER_IP_PER_MIN'];
      }
    });
  });

  describe('budget', () => {
    it('concurrent reservations never exceed the ceiling', async () => {
      const [t] = await getDb().insert(schema.tenants).values({ name: 'Orçamento' }).returning();
      const cfg = { dailyTokenLimit: 5000, monthlyTokenLimit: 1_000_000, reservationSize: 1000 };
      const results = await Promise.all(Array.from({ length: 20 }, () => reserveBudget(t!.id, cfg)));
      assert.equal(results.filter(r => r.reserved).length, 5);
      assert.ok(results.filter(r => !r.reserved).every(r => r.reason === 'Daily token budget exhausted'));
    });
  });

  describe('panel views', () => {
    let token: string;
    before(async () => { token = await loginAs(ADMIN.email, ADMIN.password); });

    it('metrics count the real decisions of this tenant only', async () => {
      const r = await call('GET', '/metrics/summary?days=7', { token });
      assert.equal(r.status, 200);
      assert.ok(r.json.totalAccesses >= 1);
      assert.ok(r.json.routePrimary >= 1);
      assert.equal(typeof r.json.latencyP95Ms, 'number');
      const other = await loginAs('other@test.local', 'pw-other-123');
      const o = await call('GET', '/metrics/summary', { token: other });
      assert.equal(o.json.totalAccesses, 0);
    });

    it('tenant-wide events are isolated', async () => {
      const mine = await call('GET', '/events?limit=5', { token });
      assert.equal(mine.status, 200);
      assert.ok(mine.json.items.length >= 1);
      const other = await loginAs('other@test.local', 'pw-other-123');
      assert.equal((await call('GET', '/events', { token: other })).json.items.length, 0);
    });

    it('engine status reports adapter, health and budget', async () => {
      const r = await call('GET', '/engine/status', { token });
      assert.equal(r.status, 200);
      assert.equal(r.json.adapter, 'mock');
      assert.equal(r.json.healthy, true);
      assert.ok(r.json.budget.usedMonth >= 1000);
    });

    it('tenant view lists members with their roles', async () => {
      const r = await call('GET', '/tenant', { token });
      assert.equal(r.status, 200);
      const roles = Object.fromEntries(r.json.members.map((m: any) => [m.email, m.role]));
      assert.equal(roles[ADMIN.email], 'owner');
      assert.equal(roles['viewer@test.local'], 'viewer');
      assert.ok(!('passwordHash' in r.json.members[0]));
    });

    it('panel views require a session', async () => {
      for (const p of ['/metrics/summary', '/events', '/engine/status', '/tenant']) {
        assert.equal((await call('GET', p)).status, 401, p);
      }
    });
  });

  describe('CORS', () => {
    it('does not allow arbitrary origins', async () => {
      const r = await call('GET', '/health', { headers: { Origin: 'https://evil.example' } });
      assert.equal(r.headers.get('access-control-allow-origin'), null);
    });

    it('allows localhost in development', async () => {
      const r = await call('GET', '/health', { headers: { Origin: 'http://localhost:5173' } });
      assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    });
  });
});

describe('confidence thresholds', () => {
  const dec = (a: ReturnType<typeof createMockJevAssessment>) => applyPolicy(a, 'general', 'P', 'A', null, Date.now());

  it('releases the primary only above the human threshold', () => {
    assert.equal(dec(createMockJevAssessment('likely_human', { confidence: 0.9 })).action, 'route_primary');
    const low = dec(createMockJevAssessment('likely_human', { confidence: 0.5 }));
    assert.equal(low.action, 'route_alternative');
    assert.equal(low.reasonCode, 'LOW_EVIDENCE_CHALLENGE');
  });

  it('a contradicted human verdict does not release the primary', () => {
    const d = dec(createMockJevAssessment('likely_human', {
      confidence: 0.9,
      probabilities: { likely_human: 0.55, likely_automation: 0.4, insufficient_evidence: 0.05 },
    }));
    assert.equal(d.action, 'route_alternative');
  });

  it('weak automation verdicts are marked as uncertainty, not as bots', () => {
    assert.equal(dec(createMockJevAssessment('likely_automation', { confidence: 0.9 })).reasonCode, 'JEV_AUTOMATION_ALTERNATIVE');
    assert.equal(dec(createMockJevAssessment('likely_automation', { confidence: 0.4 })).reasonCode, 'LOW_EVIDENCE_CHALLENGE');
  });
});
