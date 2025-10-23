import type { EnvBindings } from '../env.js';
import { getSupabase } from './supabase.js';
import { getAnalyticsOptIn } from './analyticsStore.js';

const hasSupabase = (env: EnvBindings): boolean =>
  Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);

interface BaseEvent {
  user_id: string;
  event: string;
  feature?: 'ideas' | 'replies' | 'panel';
  duration_ms?: number;
  trends_used?: boolean;
  sources_used?: number;
  created_at?: string;
}

const logToSupabase = async (env: EnvBindings, payload: BaseEvent): Promise<void> => {
  if (!hasSupabase(env)) {
    return;
  }

  try {
    const client = getSupabase(env);
    await client.from('events').insert({
      ...payload,
      created_at: payload.created_at ?? new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[analytics] failed to record event', error);
  }
};

export const logFeatureEvent = async (
  env: EnvBindings,
  payload: Omit<BaseEvent, 'event'> & { event?: string },
): Promise<void> => {
  if (!getAnalyticsOptIn(payload.user_id)) {
    return;
  }

  await logToSupabase(env, {
    event: payload.event ?? 'feature_usage',
    ...payload,
  });
};

export const logPanelEvent = async (
  env: EnvBindings,
  payload: { user_id: string; event: 'panel_open' | 'panel_close' },
): Promise<void> => {
  if (!getAnalyticsOptIn(payload.user_id)) {
    return;
  }

  await logToSupabase(env, {
    ...payload,
    feature: 'panel',
  });
};
