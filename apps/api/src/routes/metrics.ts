import { Hono } from "hono";
import type { AppBindings, AppVariables } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { ensureAnalyticsPreference, getTrendMetrics } from "../lib/analyticsStore.js";

const metrics = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

metrics.use("*", requireAuth);
metrics.use("*", rateLimiter);

metrics.get("/trends", async (context) => {
  const user = context.get("user");
  const userId = user?.sub ?? "anonymous";
  const analyticsOptIn = await ensureAnalyticsPreference(context.env, userId);
  const metrics = getTrendMetrics(userId);

  return context.json({
    estimated_usd_rolling_24h: Number(metrics.cost.toFixed(2)),
    calls_24h: metrics.calls,
    want_analytics: analyticsOptIn,
  });
});

export default metrics;
