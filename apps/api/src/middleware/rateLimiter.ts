import type { MiddlewareHandler } from 'hono';
import type { AppBindings, AppVariables } from '../types.js';

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

const DEFAULT_OPTIONS: RateLimiterOptions = {
  limit: 60,
  windowMs: 60 * 60 * 1000,
};

type Bucket = {
  remaining: number;
  reset: number;
};

const buckets = new Map<string, Bucket>();
let options: RateLimiterOptions = { ...DEFAULT_OPTIONS };

export const setRateLimiterOptions = (patched: Partial<RateLimiterOptions>): void => {
  options = { ...options, ...patched };
};

export const resetRateLimiterState = (): void => {
  buckets.clear();
  options = { ...DEFAULT_OPTIONS };
};

export const rateLimiter: MiddlewareHandler<{ Bindings: AppBindings; Variables: AppVariables }> =
  async (context, next) => {
    const user = context.get('user');
    const userId = user?.sub ?? 'anonymous';
    const now = Date.now();
    const existing = buckets.get(userId);

    if (!existing || now >= existing.reset) {
      buckets.set(userId, {
        remaining: options.limit - 1,
        reset: now + options.windowMs,
      });
      return next();
    }

    if (existing.remaining <= 0) {
      return context.json({ error: 'rate_limited' }, 429);
    }

    existing.remaining -= 1;
    buckets.set(userId, existing);
    await next();
  };
