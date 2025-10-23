import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppBindings, AppVariables } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { ensureAnalyticsPreference } from "../lib/analyticsStore.js";
import { logPanelEvent } from "../lib/analyticsLogger.js";

const EventsSchema = z.object({
  event: z.enum(["panel_open", "panel_close"]),
});

const analytics = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

analytics.use("*", requireAuth);
analytics.use("*", rateLimiter);

analytics.post("/events", zValidator("json", EventsSchema), async (context) => {
  const body = context.req.valid("json");
  const user = context.get("user");
  const userId = user?.sub ?? "anonymous";
  const enabled = await ensureAnalyticsPreference(context.env, userId);

  if (enabled) {
    await logPanelEvent(context.env, { user_id: userId, event: body.event });
  }

  return context.json({ success: true });
});

export default analytics;
