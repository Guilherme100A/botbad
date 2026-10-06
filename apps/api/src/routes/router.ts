import { Hono, type Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { executePipeline } from '../decision/pipeline.js';
import { getConfig } from '../config.js';

/** Socket peer address. Under the node server this is the real TCP peer; elsewhere (tests) it is unknown. */
function peerAddress(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? '';
  } catch {
    return '';
  }
}

const routerRoutes = new Hono();

routerRoutes.get('/r/:slug', async (c) => {
  const slug = c.req.param('slug');

  const headers: Record<string, string | undefined> = {
    'user-agent': c.req.header('user-agent'),
    'accept': c.req.header('accept'),
    'accept-language': c.req.header('accept-language'),
    'x-forwarded-for': c.req.header('x-forwarded-for'),
    'x-real-ip': c.req.header('x-real-ip'),
  };

  const config = getConfig();
  const result = await executePipeline({
    slug,
    peerIp: peerAddress(c),
    userAgent: c.req.header('user-agent') ?? '',
    headers,
    // X-Forwarded-For is only honored when the peer is a configured proxy (e.g. Caddy).
    trustedProxies: config.trustedProxies,
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
    // Debug aid only: never tell a visitor (or a bot) which decision it got in production.
    if (!config.isProduction) c.header('X-Decision-Id', result.decision.decisionId);
    return c.redirect(result.destinationUrl, 302);
  }

  return c.text('Service Unavailable', 503);
});

export { routerRoutes };
