import { serve } from '@hono/node-server';
import app from './index.js';
import { getConfig } from './config.js';
import { setJevAdapter } from './decision/pipeline.js';
import { JevMockAdapter } from './adapters/jev-mock.js';
import { JevRealAdapter } from './adapters/jev-real.js';
import { JevOpenRouterAdapter } from './adapters/jev-openrouter.js';

// Fails fast on missing/unsafe settings (see config.ts).
const config = getConfig();

switch (config.jevAdapter) {
  case 'real':
    setJevAdapter(new JevRealAdapter(config.jevApiKey, undefined, config.jevTimeoutMs));
    break;
  case 'openrouter':
    setJevAdapter(new JevOpenRouterAdapter(config.openRouterApiKey!, undefined, config.jevTimeoutMs));
    break;
  default:
    setJevAdapter(new JevMockAdapter());
}
console.log(`[server] Jev adapter: ${config.jevAdapter}`);
if (!config.isProduction && !process.env['JWT_SECRET']) {
  console.warn('[server] JWT_SECRET not set: using a random per-process secret (dev only)');
}

// @hono/node-server exposes the socket so routes can read the real peer address (getConnInfo).
serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[server] Listening on http://localhost:${info.port}`);
});
