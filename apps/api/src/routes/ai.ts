import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  IdeasRequestSchema,
  RepliesRequestSchema,
  StyleProfileRequestSchema,
} from '@pulse-kit/shared';
import type { AppBindings, AppVariables } from '../types.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { generateIdeas } from '../services/ideaEngine.js';
import { generateReplies } from '../services/replyCopilot.js';
import { buildStyleProfile } from '../services/styleProfile.js';
import { ensureAnalyticsPreference } from '../lib/analyticsStore.js';
import { logFeatureEvent } from '../lib/analyticsLogger.js';

const ai = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

ai.use('*', requireAuth);
ai.use('*', rateLimiter);

ai.post('/ideas', zValidator('json', IdeasRequestSchema), async (context) => {
  const body = context.req.valid('json');
  const user = context.get('user');
  const userId = user?.sub ?? 'anonymous';
  const analyticsEnabled = await ensureAnalyticsPreference(context.env, userId);
  const startedAt = Date.now();

  const result = await generateIdeas(context.env, body, { userId });
  const duration = Date.now() - startedAt;

  if (analyticsEnabled) {
    await logFeatureEvent(context.env, {
      user_id: userId,
      feature: 'ideas',
      duration_ms: duration,
      trends_used: result.metrics.trendsUsed,
      sources_used: result.metrics.sourcesUsedCount,
    });
  }

  return context.json(result.response);
});

ai.post('/replies', zValidator('json', RepliesRequestSchema), async (context) => {
  const body = context.req.valid('json');
  const user = context.get('user');
  const userId = user?.sub ?? 'anonymous';
  const analyticsEnabled = await ensureAnalyticsPreference(context.env, userId);
  const startedAt = Date.now();

  const result = await generateReplies(context.env, body, { userId });
  const duration = Date.now() - startedAt;

  if (analyticsEnabled) {
    await logFeatureEvent(context.env, {
      user_id: userId,
      feature: 'replies',
      duration_ms: duration,
      trends_used: false,
      sources_used: 0,
    });
  }

  return context.json(result.response);
});

ai.post('/style-profile', zValidator('json', StyleProfileRequestSchema), async (context) => {
  const body = context.req.valid('json');
  const profile = buildStyleProfile(body);
  return context.json({ style_profile: profile });
});

export default ai;

