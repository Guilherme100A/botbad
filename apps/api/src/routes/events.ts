import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, lt, desc } from 'drizzle-orm';
import { campaigns, decisionEvents } from '@botbad/db';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db.js';

const eventRoutes = new Hono();

eventRoutes.use('*', authMiddleware);

const queryInput = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

eventRoutes.get('/:id/events', async (c) => {
  const auth = c.get('auth');
  const db = getDb();
  const campaignId = c.req.param('id');

  const [campaign] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, auth.tenantId)));

  if (!campaign) {
    return c.json({ code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  const parsed = queryInput.safeParse({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid pagination params', details: parsed.error.flatten() },
      400,
    );
  }

  const { cursor, limit } = parsed.data;

  const conditions = [
    eq(decisionEvents.tenantId, auth.tenantId),
    eq(decisionEvents.campaignId, campaignId),
  ];
  if (cursor) {
    conditions.push(lt(decisionEvents.timestamp, new Date(cursor)));
  }

  const rows = await db
    .select()
    .from(decisionEvents)
    .where(and(...conditions))
    .orderBy(desc(decisionEvents.timestamp))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && items.length > 0
    ? items[items.length - 1].timestamp.toISOString()
    : null;

  return c.json({
    items,
    pagination: { nextCursor, hasMore },
  });
});

export { eventRoutes };
