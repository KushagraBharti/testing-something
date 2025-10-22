import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings, AppVariables } from '../types.js';
import { createJwt } from '../lib/jwt.js';
import { recordUserLogin, updateSettings } from '../services/userStore.js';

const RefreshRequestSchema = z.object({
  user_id: z.string().min(3),
  handle: z.string().min(1),
  avatar_url: z.string().url().optional(),
  settings: z
    .object({
      model: z.enum(['openai', 'xai']).default('openai'),
      temp: z.number().min(0).max(1).optional(),
      want_trends: z.boolean().optional(),
      trend_sources_max: z.number().min(0).max(2).optional(),
    })
    .optional(),
});

const auth = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

auth.post('/refresh', zValidator('json', RefreshRequestSchema), async (context) => {
  const payload = context.req.valid('json');

  await recordUserLogin(context.env, {
    id: payload.user_id,
    handle: payload.handle,
    avatar_url: payload.avatar_url,
  });

  if (payload.settings) {
    await updateSettings(context.env, payload.user_id, payload.settings);
  }

  const token = await createJwt({ sub: payload.user_id, scope: ['ideas', 'replies'] }, context.env);
  return context.json({ token, expires_in: 900 });
});

auth.get('/health', (context) => context.json({ ok: true }));

export default auth;

