import {
  IdeasRequestSchema,
  clipText,
  tokenizeWords,
  type ClusterResponseOutput,
  type IdeasRequest,
  type IdeasResponse,
} from '@pulse-kit/shared';
import type { EnvBindings } from '../env.js';
import { clusterSnippetsWithOpenAI, generateIdeasWithOpenAI } from './providers/openai.js';
import { fetchTrendSparks } from './providers/xai.js';
import type { IdeaEngineResult } from './types.js';

const STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'that',
  'this',
  'from',
  'have',
  'what',
  'your',
  'about',
  'into',
  'just',
]);

const fallbackCluster = (snippets: string[]): ClusterResponseOutput => {
  const buckets: Record<string, string[]> = {};

  snippets.forEach((snippet) => {
    const tokens = tokenizeWords(snippet.toLowerCase()).filter((word) => !STOP_WORDS.has(word));
    const key = tokens.slice(0, 2).join(' ') || 'general';

    if (!buckets[key]) {
      buckets[key] = [];
    }
    buckets[key].push(snippet);
  });

  return Object.entries(buckets)
    .slice(0, 5)
    .map(([topic, items]) => ({
      topic,
      pain_points: items.slice(0, 3),
      quotes: items.slice(0, 2),
    }));
};

const buildOutline = (topic: string, painPoints: string[]): string[] => {
  return [
    `Why ${topic} matters right now`,
    painPoints[0] ?? `Hidden friction creators face with ${topic}`,
    painPoints[1] ?? `Quick win to move on ${topic} today`,
    painPoints[2] ?? `Story from the field about ${topic}`,
    `Prompt your audience with an open question on ${topic}`,
  ];
};

const fallbackIdeas = (snippets: string[]): IdeasResponse => {
  const clusters = fallbackCluster(snippets);
  const ideas = clusters.map((cluster) => ({
    topic: cluster.topic,
    trend_notes: [],
    items: [
      {
        hook: `Fresh angle on ${cluster.topic}`,
        mini_outline: buildOutline(cluster.topic, cluster.pain_points),
        virality_score: 55,
        recommended_time: 'morning' as const,
      },
    ],
  }));

  return { ideas };
};

const safeSnippets = (snippets: string[]): string[] =>
  snippets.slice(0, 30).map((item) => clipText(item, 240));

export const generateIdeas = async (
  env: EnvBindings,
  request: IdeasRequest,
): Promise<IdeaEngineResult> => {
  const parsed = IdeasRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error('Invalid request body');
  }

  const snippets = safeSnippets(parsed.data.snippets);
  let clusters: ClusterResponseOutput;

  try {
    clusters = await clusterSnippetsWithOpenAI(env, snippets);
  } catch {
    clusters = fallbackCluster(snippets);
  }

  let trendNotes: string[] = [];
  let sourcesUsed: Array<{ name: string; url?: string }> = [];

  if (parsed.data.want_trends) {
    try {
      const trendResult = await fetchTrendSparks(env, clusters, parsed.data.trend_sources_max ?? 1);
      trendNotes = trendResult.trend_notes;
      sourcesUsed = trendResult.sources_used;
    } catch {
      trendNotes = [];
    }
  }

  try {
    const ideas = await generateIdeasWithOpenAI(env, {
      snippets,
      style_profile: parsed.data.style_profile,
      clusters,
      trend_notes: trendNotes,
    });

    return {
      response: {
        ...ideas,
        sources_used: ideas.sources_used ?? sourcesUsed,
      },
      sources_used: ideas.sources_used ?? sourcesUsed,
    };
  } catch {
    return { response: fallbackIdeas(snippets), sources_used: sourcesUsed };
  }
};
