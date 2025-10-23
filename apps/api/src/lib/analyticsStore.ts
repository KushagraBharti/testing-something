import type { EnvBindings } from '../env.js';
import { getSupabase } from './supabase.js';

type TrendRecord = {
  timestamp: number;
  cost: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const analyticsOptIn = new Map<string, boolean>();
const trendUsage = new Map<string, TrendRecord[]>();

const prune = (records: TrendRecord[], now: number) =>
  records.filter((record) => now - record.timestamp <= ONE_DAY_MS);

export const setAnalyticsOptIn = (userId: string, enabled: boolean): void => {
  analyticsOptIn.set(userId, enabled);
};

export const getAnalyticsOptIn = (userId: string): boolean => analyticsOptIn.get(userId) ?? false;

export const ensureAnalyticsPreference = async (
  env: EnvBindings,
  userId: string,
): Promise<boolean> => {
  if (analyticsOptIn.has(userId)) {
    return analyticsOptIn.get(userId) ?? false;
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return false;
  }

  try {
    const client = getSupabase(env);
    const { data } = await client
      .from('settings')
      .select('want_analytics')
      .eq('user_id', userId)
      .maybeSingle();

    const enabled = Boolean(data?.want_analytics);
    analyticsOptIn.set(userId, enabled);
    return enabled;
  } catch (error) {
    console.warn('[analytics] failed to fetch preference', error);
    return false;
  }
};

export const recordTrendUsage = (userId: string, cost: number, timestamp: number): void => {
  const list = trendUsage.get(userId) ?? [];
  list.push({ timestamp, cost });
  trendUsage.set(userId, prune(list, timestamp));
};

export const getTrendMetrics = (userId: string): { cost: number; calls: number } => {
  const now = Date.now();
  const list = prune(trendUsage.get(userId) ?? [], now);
  trendUsage.set(userId, list);

  return {
    cost: Number(list.reduce((sum, record) => sum + record.cost, 0).toFixed(3)),
    calls: list.length,
  };
};

export const resetAnalyticsState = (): void => {
  analyticsOptIn.clear();
  trendUsage.clear();
};
