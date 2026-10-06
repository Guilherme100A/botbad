import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth.js';
import { campaignRoutes } from './routes/campaigns.js';
import { destinationRoutes } from './routes/destinations.js';
import { eventRoutes } from './routes/events.js';
import { routerRoutes } from './routes/router.js';

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/auth', authRoutes);
app.route('/campaigns', campaignRoutes);
app.route('/campaigns', eventRoutes);
app.route('/destinations', destinationRoutes);
app.route('/', routerRoutes);

export default app;
export type AppType = typeof app;
