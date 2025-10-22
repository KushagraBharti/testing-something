
import type { EnvBindings } from '../env.js';
import { getSupabase } from '../lib/supabase.js';

export const recordUserLogin = async (
  env: EnvBindings,
  user: { id: string; handle: string; avatar_url?: string | null },
) => {
  const client = getSupabase(env);
  const { error } = await client.from('users').upsert(
    {
      id: user.id,
      handle: user.handle,
      avatar_url: user.avatar_url ?? null,
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Failed to upsert user: ${error.message}`);
  }
};

export const saveEncryptedKey = async (
  env: EnvBindings,
  data: { user_id: string; provider: 'openai' | 'xai' | 'x'; value: string },
) => {
  const client = getSupabase(env);
  const { error } = await client.from('keys').upsert(
    {
      user_id: data.user_id,
      provider: data.provider,
      enc_key: data.value,
    },
    { onConflict: 'user_id,provider' },
  );

  if (error) {
    throw new Error(`Failed to save key: ${error.message}`);
  }
};

export const updateSettings = async (
  env: EnvBindings,
  userId: string,
  settings: {
    model: 'openai' | 'xai';
    temp?: number;
    want_trends?: boolean;
    trend_sources_max?: number;
  },
) => {
  const client = getSupabase(env);
  const { error } = await client.from('settings').upsert(
    {
      user_id: userId,
      model: settings.model,
      temp: settings.temp ?? 0.7,
      want_trends: settings.want_trends ?? false,
      trend_sources_max: settings.trend_sources_max ?? 1,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }
};
