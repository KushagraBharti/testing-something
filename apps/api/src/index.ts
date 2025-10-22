import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppBindings, AppVariables } from './types.js';
import aiRoute from './routes/ai.js';
import authRoute from './routes/auth.js';
import keysRoute from './routes/keys.js';

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'chrome-extension://*'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

app.get('/', (context) => context.json({ service: 'pulse-kit-api', ok: true }));

app.route('/auth', authRoute);
app.route('/ai', aiRoute);
app.route('/keys', keysRoute);

export default app;

