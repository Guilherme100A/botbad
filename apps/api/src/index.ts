import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getConfig } from './config.js';
import { authRoutes } from './routes/auth.js';
import { campaignRoutes } from './routes/campaigns.js';
import { destinationRoutes } from './routes/destinations.js';
import { eventRoutes } from './routes/events.js';
import { simulateRoutes } from './decision/simulate.js';
import { routerRoutes } from './routes/router.js';

const app = new Hono();

// Only the panel's origin(s) may call the API from a browser. The router (/r/*) is a plain redirect and needs no CORS.
app.use('*', cors({
  origin: (origin) => {
    const { corsOrigins, isProduction } = getConfig();
    if (!origin) return null;
    if (corsOrigins.includes(origin)) return origin;
    if (!isProduction && corsOrigins.length === 0 && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
    return null;
  },
}));

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/auth', authRoutes);
app.route('/campaigns', campaignRoutes);
app.route('/campaigns', eventRoutes);
app.route('/campaigns', simulateRoutes);
app.route('/destinations', destinationRoutes);
app.route('/', routerRoutes);

export default app;
export type AppType = typeof app;
