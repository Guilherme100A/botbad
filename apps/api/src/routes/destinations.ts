import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { destinations } from '@botbad/db';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { getConfig } from '../config.js';
import { checkDestinationUrl } from '../decision/destination-url.js';

const destinationRoutes = new Hono();

destinationRoutes.use('*', authMiddleware);

const createInput = z.object({
  url: z.string().max(2048).superRefine((u, ctx) => {
    const check = checkDestinationUrl(u, getConfig().publicBaseUrl);
    if (!check.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.reason });
  }),
  label: z.string().min(1).max(255),
});

destinationRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const db = getDb();

  const rows = await db
    .select()
    .from(destinations)
    .where(eq(destinations.tenantId, auth.tenantId));

  return c.json({ items: rows });
});

destinationRoutes.post('/', requireRole('owner', 'operator'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json();
  const parsed = createInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid destination input', details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();
  const [row] = await db
    .insert(destinations)
    .values({
      tenantId: auth.tenantId,
      url: parsed.data.url,
      label: parsed.data.label,
    })
    .returning();

  return c.json(row, 201);
});

export { destinationRoutes };
