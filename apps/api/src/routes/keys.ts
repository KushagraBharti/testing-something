import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppBindings, AppVariables } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { encryptSecret } from "../lib/encryption.js";
import { saveEncryptedKey } from "../services/userStore.js";

const KeysPayloadSchema = z.object({
  keys: z
    .array(
      z.object({
        provider: z.enum(["openai", "xai", "x"]),
        value: z.string().min(10),
      }),
    )
    .min(1),
});

// Prefer Supabase RLS with a service-role key server-side; never expose privileged keys to clients.
const keysRoute = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

keysRoute.use("*", requireAuth);

keysRoute.post("/", zValidator("json", KeysPayloadSchema), async (context) => {
  const origin = context.req.header("Origin");
  if (origin && context.env.WEB_ORIGIN && origin !== context.env.WEB_ORIGIN) {
    return context.json({ error: "Forbidden" }, 403);
  }

  const { keys } = context.req.valid("json");
  const user = context.get("user");
  if (!user?.sub) {
    return context.json({ error: "Missing user id" }, 400);
  }

  if (!user.scope?.includes("settings")) {
    return context.json({ error: "Forbidden" }, 403);
  }

  const encryptionKey = context.env.BYO_ENCRYPTION_KEY ?? context.env.JWT_SECRET;

  await Promise.all(
    keys.map(async ({ provider, value }) => {
      const encrypted = await encryptSecret(value, encryptionKey);
      await saveEncryptedKey(context.env, {
        user_id: user.sub,
        provider,
        value: encrypted,
      });
    }),
  );

  return context.json({ success: true });
});

export default keysRoute;
