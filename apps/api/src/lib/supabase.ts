
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { EnvBindings } from "../env.js";

let client: SupabaseClient | null = null;

export const getSupabase = (env: EnvBindings): SupabaseClient => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase credentials are not configured");
  }

  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
      },
    });
  }

  return client;
};

