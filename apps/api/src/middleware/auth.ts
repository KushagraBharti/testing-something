import type { MiddlewareHandler } from 'hono';
import { verifyJwt } from '../lib/jwt.js';
import type { AppBindings, AppVariables } from '../types.js';

export const requireAuth: MiddlewareHandler<{ Bindings: AppBindings; Variables: AppVariables }> =
  async (context, next) => {
    const header = context.req.header('authorization') ?? context.req.header('Authorization');

    if (!header || !header.startsWith('Bearer ')) {
      return context.json({ error: 'Unauthorized' }, 401);
    }

    const token = header.slice('Bearer '.length).trim();
    const payload = await verifyJwt(token, context.env);
    if (!payload) {
      return context.json({ error: 'Unauthorized' }, 401);
    }

    context.set('user', payload);
    await next();
  };

