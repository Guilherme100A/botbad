import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { campaigns } from '@botbad/db';
import { getDb } from '../db.js';

const routerRoutes = new Hono();

routerRoutes.get('/r/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb();

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.slug, slug));

  if (!campaign) {
    return c.json({ code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  if (campaign.status !== 'active') {
    return c.json({ code: 'CAMPAIGN_INACTIVE', message: 'Campaign is not active' }, 503);
  }

  // T4 will implement the full decision pipeline here.
  // For now, return a placeholder indicating this endpoint exists.
  return c.json({
    message: 'Decision pipeline placeholder — will be implemented in T4',
    campaignId: campaign.id,
    slug: campaign.slug,
  });
});

export { routerRoutes };
