import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { campaigns, destinations, auditLog } from '@botbad/db';
import { NetworkProfileSchema } from '@botbad/contracts';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { randomBytes } from 'node:crypto';
import { getConfig } from '../config.js';
import { checkDestinationUrl } from '../decision/destination-url.js';

const campaignRoutes = new Hono();

campaignRoutes.use('*', authMiddleware);

const createInput = z.object({
  name: z.string().min(1).max(255),
  primaryDestinationId: z.string().uuid(),
  alternativeDestinationId: z.string().uuid(),
  networkProfile: NetworkProfileSchema.optional(),
});

const patchInput = z.object({
  name: z.string().min(1).max(255).optional(),
  primaryDestinationId: z.string().uuid().optional(),
  alternativeDestinationId: z.string().uuid().optional(),
  networkProfile: NetworkProfileSchema.optional(),
});

function generateSlug(): string {
  return randomBytes(6).toString('base64url').toLowerCase();
}

async function validateDestinationOwnership(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  destinationId: string,
): Promise<{ valid: boolean; url?: string }> {
  const [dest] = await db
    .select()
    .from(destinations)
    .where(and(eq(destinations.id, destinationId), eq(destinations.tenantId, tenantId)));
  return dest ? { valid: true, url: dest.url } : { valid: false };
}

function detectLoop(slug: string | null, url: string): boolean {
  try {
    const parsed = new URL(url);
    // Same campaign link on any host is a loop; any /r/* on our own host is one too.
    if (slug && parsed.pathname === `/r/${slug}`) return true;
    const check = checkDestinationUrl(url, getConfig().publicBaseUrl);
    return !check.ok && check.reason.includes('loop');
  } catch {
    return false;
  }
}

campaignRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const db = getDb();

  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.tenantId, auth.tenantId));

  return c.json({ items: rows });
});

campaignRoutes.get('/:id', async (c) => {
  const auth = c.get('auth');
  const db = getDb();
  const id = c.req.param('id');

  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, auth.tenantId)));

  if (!row) {
    return c.json({ code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  return c.json(row);
});

campaignRoutes.post('/', requireRole('owner', 'operator'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json();
  const parsed = createInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid campaign input', details: parsed.error.flatten() },
      400,
    );
  }

  const { name, primaryDestinationId, alternativeDestinationId, networkProfile } = parsed.data;

  if (primaryDestinationId === alternativeDestinationId) {
    return c.json(
      { code: 'DESTINATIONS_IDENTICAL', message: 'Primary and alternative destinations must be distinct' },
      400,
    );
  }

  const db = getDb();

  const [primary, alternative] = await Promise.all([
    validateDestinationOwnership(db, auth.tenantId, primaryDestinationId),
    validateDestinationOwnership(db, auth.tenantId, alternativeDestinationId),
  ]);

  if (!primary.valid) {
    return c.json({ code: 'DESTINATION_INVALID', message: 'Primary destination not found or not owned by tenant' }, 400);
  }
  if (!alternative.valid) {
    return c.json({ code: 'DESTINATION_INVALID', message: 'Alternative destination not found or not owned by tenant' }, 400);
  }

  // Re-check: destinations may predate the current rules.
  const primaryCheck = checkDestinationUrl(primary.url!, getConfig().publicBaseUrl);
  if (!primaryCheck.ok) {
    return c.json({ code: 'DESTINATION_INVALID', message: `Destino principal: ${primaryCheck.reason}` }, 400);
  }
  const alternativeCheck = checkDestinationUrl(alternative.url!, getConfig().publicBaseUrl);
  if (!alternativeCheck.ok) {
    return c.json({ code: 'DESTINATION_INVALID', message: `Destino alternativo: ${alternativeCheck.reason}` }, 400);
  }

  const [row] = await db
    .insert(campaigns)
    .values({
      tenantId: auth.tenantId,
      name,
      primaryDestinationId,
      alternativeDestinationId,
      networkProfile: networkProfile ?? 'general',
      status: 'draft',
    })
    .returning();

  await db.insert(auditLog).values({
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'campaign.create',
    entityType: 'campaign',
    entityId: row.id,
    changes: { name, primaryDestinationId, alternativeDestinationId, networkProfile: networkProfile ?? 'general' },
  });

  return c.json(row, 201);
});

campaignRoutes.patch('/:id', requireRole('owner', 'operator'), async (c) => {
  const auth = c.get('auth');
  const db = getDb();
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = patchInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid update input', details: parsed.error.flatten() },
      400,
    );
  }

  const [existing] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, auth.tenantId)));

  if (!existing) {
    return c.json({ code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  const updates: Record<string, unknown> = {};
  const changes: Record<string, unknown> = {};

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
    changes.name = { from: existing.name, to: parsed.data.name };
  }

  const effectivePrimary = parsed.data.primaryDestinationId ?? existing.primaryDestinationId;
  const effectiveAlternative = parsed.data.alternativeDestinationId ?? existing.alternativeDestinationId;

  if (effectivePrimary === effectiveAlternative) {
    return c.json(
      { code: 'DESTINATIONS_IDENTICAL', message: 'Primary and alternative destinations must be distinct' },
      400,
    );
  }

  if (parsed.data.primaryDestinationId !== undefined) {
    const dest = await validateDestinationOwnership(db, auth.tenantId, parsed.data.primaryDestinationId);
    if (!dest.valid) {
      return c.json({ code: 'DESTINATION_INVALID', message: 'Primary destination not found or not owned' }, 400);
    }
    if (!dest.url!.startsWith('https://')) {
      return c.json({ code: 'DESTINATION_NOT_HTTPS', message: 'Primary destination must use HTTPS' }, 400);
    }
    if (detectLoop(existing.slug, dest.url!)) {
      return c.json({ code: 'DESTINATION_LOOP', message: 'Destination creates a loop with the campaign link' }, 400);
    }
    updates.primaryDestinationId = parsed.data.primaryDestinationId;
    changes.primaryDestinationId = { from: existing.primaryDestinationId, to: parsed.data.primaryDestinationId };
  }

  if (parsed.data.alternativeDestinationId !== undefined) {
    const dest = await validateDestinationOwnership(db, auth.tenantId, parsed.data.alternativeDestinationId);
    if (!dest.valid) {
      return c.json({ code: 'DESTINATION_INVALID', message: 'Alternative destination not found or not owned' }, 400);
    }
    if (!dest.url!.startsWith('https://')) {
      return c.json({ code: 'DESTINATION_NOT_HTTPS', message: 'Alternative destination must use HTTPS' }, 400);
    }
    if (detectLoop(existing.slug, dest.url!)) {
      return c.json({ code: 'DESTINATION_LOOP', message: 'Destination creates a loop with the campaign link' }, 400);
    }
    updates.alternativeDestinationId = parsed.data.alternativeDestinationId;
    changes.alternativeDestinationId = { from: existing.alternativeDestinationId, to: parsed.data.alternativeDestinationId };
  }

  if (parsed.data.networkProfile !== undefined) {
    updates.networkProfile = parsed.data.networkProfile;
    changes.networkProfile = { from: existing.networkProfile, to: parsed.data.networkProfile };
  }

  if (Object.keys(updates).length === 0) {
    return c.json(existing);
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(campaigns)
    .set(updates)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, auth.tenantId)))
    .returning();

  await db.insert(auditLog).values({
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'campaign.update',
    entityType: 'campaign',
    entityId: id,
    changes,
  });

  return c.json(updated);
});

campaignRoutes.post('/:id/activate', requireRole('owner', 'operator'), async (c) => {
  const auth = c.get('auth');
  const db = getDb();
  const id = c.req.param('id');

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, auth.tenantId)));

  if (!campaign) {
    return c.json({ code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  if (campaign.status === 'active') {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Campaign is already active' }, 400);
  }

  if (campaign.status === 'archived') {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Cannot activate an archived campaign' }, 400);
  }

  const [primary, alternative] = await Promise.all([
    validateDestinationOwnership(db, auth.tenantId, campaign.primaryDestinationId),
    validateDestinationOwnership(db, auth.tenantId, campaign.alternativeDestinationId),
  ]);

  if (!primary.valid) {
    return c.json({ code: 'DESTINATION_INVALID', message: 'Primary destination not found' }, 400);
  }
  if (!alternative.valid) {
    return c.json({ code: 'ALTERNATIVE_MISSING', message: 'Alternative destination not found' }, 400);
  }

  // Re-check: destinations may predate the current rules.
  const primaryCheck = checkDestinationUrl(primary.url!, getConfig().publicBaseUrl);
  if (!primaryCheck.ok) {
    return c.json({ code: 'DESTINATION_INVALID', message: `Destino principal: ${primaryCheck.reason}` }, 400);
  }
  const alternativeCheck = checkDestinationUrl(alternative.url!, getConfig().publicBaseUrl);
  if (!alternativeCheck.ok) {
    return c.json({ code: 'DESTINATION_INVALID', message: `Destino alternativo: ${alternativeCheck.reason}` }, 400);
  }

  if (campaign.primaryDestinationId === campaign.alternativeDestinationId) {
    return c.json(
      { code: 'DESTINATIONS_IDENTICAL', message: 'Primary and alternative destinations must be distinct' },
      400,
    );
  }

  const slug = campaign.slug ?? generateSlug();

  if (detectLoop(slug, primary.url!) || detectLoop(slug, alternative.url!)) {
    return c.json({ code: 'DESTINATION_LOOP', message: 'Destination URL creates a loop with the campaign link' }, 400);
  }

  // Status change and its audit entry commit together or not at all.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(campaigns)
      .set({ status: 'active', slug, updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, auth.tenantId)))
      .returning();

    await tx.insert(auditLog).values({
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'campaign.activate',
      entityType: 'campaign',
      entityId: id,
      changes: { status: { from: campaign.status, to: 'active' }, slug },
    });
    return row;
  });

  return c.json(updated);
});

campaignRoutes.post('/:id/pause', requireRole('owner', 'operator'), async (c) => {
  const auth = c.get('auth');
  const db = getDb();
  const id = c.req.param('id');

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, auth.tenantId)));

  if (!campaign) {
    return c.json({ code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  if (campaign.status !== 'active') {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Only active campaigns can be paused' }, 400);
  }

  const [updated] = await db
    .update(campaigns)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, auth.tenantId)))
    .returning();

  await db.insert(auditLog).values({
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'campaign.pause',
    entityType: 'campaign',
    entityId: id,
    changes: { status: { from: 'active', to: 'paused' } },
  });

  return c.json(updated);
});

export { campaignRoutes };
