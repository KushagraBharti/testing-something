import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppBindings, AppVariables } from "../types.js";
import { createJwt, verifyJwt } from "../lib/jwt.js";
import { recordUserLogin, updateSettings } from "../services/userStore.js";
import { ensureAnalyticsPreference } from "../lib/analyticsStore.js";

const RefreshRequestSchema = z.object({
  user_id: z.string().min(3),
  handle: z.string().min(1),
  avatar_url: z.string().url().optional(),
  refresh_token: z.string().min(10).optional(),
  session_token: z.string().min(6).optional(),
  settings: z
    .object({
      model: z.enum(["openai", "xai"]).default("openai"),
      temp: z.number().min(0).max(1).optional(),
      want_trends: z.boolean().optional(),
      trend_sources_max: z.number().min(0).max(2).optional(),
      want_analytics: z.boolean().optional(),
    })
    .optional(),
});

const auth = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

auth.post("/refresh", zValidator("json", RefreshRequestSchema), async (context) => {
  const payload = context.req.valid("json");
  const authHeader = context.req.header("authorization") ?? context.req.header("Authorization");

  let verifiedSub: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const decoded = await verifyJwt(token, context.env);
    if (decoded?.sub) {
      verifiedSub = decoded.sub;
    }
  }

  if (!verifiedSub && payload.refresh_token) {
    const decoded = await verifyJwt(payload.refresh_token, context.env);
    if (decoded?.sub) {
      verifiedSub = decoded.sub;
    }
  }

  if (!verifiedSub && payload.session_token) {
    const expected = context.env.SESSION_TOKEN_SECRET ?? context.env.JWT_SECRET;
    if (payload.session_token === expected) {
      verifiedSub = payload.user_id;
    }
  }

  if (!verifiedSub || verifiedSub !== payload.user_id) {
    return context.json({ error: "Unauthorized" }, 401);
  }

  await recordUserLogin(context.env, {
    id: payload.user_id,
    handle: payload.handle,
    avatar_url: payload.avatar_url,
  });

  if (payload.settings) {
    await updateSettings(context.env, payload.user_id, payload.settings);
  }

  const scopes = new Set(["ideas", "replies"]);
  if (payload.settings || payload.session_token) {
    scopes.add("settings");
  }

  const accessToken = await createJwt({ sub: payload.user_id, scope: Array.from(scopes) }, context.env, 900);
  const refreshToken = await createJwt({ sub: payload.user_id, scope: ["refresh"] }, context.env, 60 * 60 * 24 * 7);

  const analyticsEnabled = await ensureAnalyticsPreference(context.env, payload.user_id);

  return context.json({
    token: accessToken,
    refresh_token: refreshToken,
    expires_in: 900,
    analytics_enabled: analyticsEnabled,
  });
});

auth.get("/health", (context) => context.json({ ok: true }));

export default auth;
