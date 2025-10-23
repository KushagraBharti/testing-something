import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppBindings, AppVariables } from "./types.js";
import aiRoute from "./routes/ai.js";
import authRoute from "./routes/auth.js";
import keysRoute from "./routes/keys.js";
import metricsRoute from "./routes/metrics.js";
import analyticsRoute from "./routes/analytics.js";

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

app.use("*", async (context, next) => {
  const origins = [context.env.WEB_ORIGIN, context.env.EXTENSION_ORIGIN].filter(Boolean) as string[];
  const corsMiddleware = cors({
    origin: origins.length ? origins : ["http://localhost:5173"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  });

  return corsMiddleware(context, next);
});

app.get("/", (context) => context.json({ service: "pulse-kit-api", ok: true }));

app.route("/auth", authRoute);
app.route("/ai", aiRoute);
app.route("/keys", keysRoute);
app.route("/metrics", metricsRoute);
app.route("/analytics", analyticsRoute);

export default app;
