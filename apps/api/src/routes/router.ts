import { Hono } from 'hono';
import { executePipeline } from '../decision/pipeline.js';

const routerRoutes = new Hono();

routerRoutes.get('/r/:slug', async (c) => {
  const slug = c.req.param('slug');

  const peerIp =
    c.req.header('x-real-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1';

  const userAgent = c.req.header('user-agent') ?? '';

  const headers: Record<string, string | undefined> = {
    'user-agent': c.req.header('user-agent'),
    'accept': c.req.header('accept'),
    'accept-language': c.req.header('accept-language'),
    'x-forwarded-for': c.req.header('x-forwarded-for'),
    'x-real-ip': c.req.header('x-real-ip'),
  };

  const result = await executePipeline({
    slug,
    peerIp,
    userAgent,
    headers,
  });

  if (result.decision.action === 'deny') {
    const reasonCode = result.decision.reasonCode;
    if (reasonCode === 'CAMPAIGN_INVALID') {
      return c.text('Not Found', 404);
    }
    if (reasonCode === 'RATE_LIMIT') {
      c.header('Retry-After', '60');
      return c.text('Too Many Requests', 429);
    }
    if (reasonCode === 'DESTINATION_INVALID') {
      return c.text('Service Unavailable', 503);
    }
    return c.text('Service Unavailable', 503);
  }

  if (result.destinationUrl) {
    c.header('Cache-Control', 'private, no-store');
    c.header('X-Decision-Id', result.decision.decisionId);
    return c.redirect(result.destinationUrl, 302);
  }

  return c.text('Service Unavailable', 503);
});

export { routerRoutes };
