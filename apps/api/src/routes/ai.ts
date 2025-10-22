import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  IdeasRequestSchema,
  RepliesRequestSchema,
  StyleProfileRequestSchema,
} from '@pulse-kit/shared';
import type { AppBindings, AppVariables } from '../types.js';
import { requireAuth } from '../middleware/auth.js';
import { generateIdeas } from '../services/ideaEngine.js';
import { generateReplies } from '../services/replyCopilot.js';
import { buildStyleProfile } from '../services/styleProfile.js';

const ai = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

ai.use('*', requireAuth);

ai.post('/ideas', zValidator('json', IdeasRequestSchema), async (context) => {
  const body = context.req.valid('json');
  const result = await generateIdeas(context.env, body);
  return context.json(result.response);
});

ai.post('/replies', zValidator('json', RepliesRequestSchema), async (context) => {
  const body = context.req.valid('json');
  const result = await generateReplies(context.env, body);
  return context.json(result.response);
});

ai.post('/style-profile', zValidator('json', StyleProfileRequestSchema), async (context) => {
  const body = context.req.valid('json');
  const profile = buildStyleProfile(body);
  return context.json({ style_profile: profile });
});

export default ai;

