import {
  IdeasRequestSchema,
  IdeasResponseSchema,
  clipText,
  tokenizeWords,
  normalizeWhitespace,
  countWords,
  truncateWords,
  clampVisibleLength,
  stableObjectHash,
  type ClusterResponseOutput,
  type IdeasRequest,
  type IdeasResponse,
} from '@pulse-kit/shared';
import type { EnvBindings } from '../env.js';
import { recordTrendUsage } from '../lib/analyticsStore.js';
import { clusterSnippetsWithOpenAI, generateIdeasWithOpenAI } from './providers/openai.js';
import { fetchTrendSparks } from './providers/xai.js';
import type { IdeaEngineResult } from './types.js';

const HOOK_WORD_LIMIT = 18;
const MIN_IDEA_COUNT = 5;
const MAX_IDEA_COUNT = 6;
const LITE_IDEA_MIN = 3;

const OUTLINE_FILLERS = [
  'Ground the angle with a clear proof point.',
  'Name the friction your audience is feeling.',
  'Offer a micro action they can ship today.',
  'Share a personal example or lesson learned.',
  'Close with a question that invites replies.',
  'Contrast the old playbook vs. new approach.',
  'Highlight a metric that signals momentum.',
];

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
    .slice(0, MAX_IDEA_COUNT)
    .map(([topic, items]) => ({
      topic,
      pain_points: items.slice(0, 3),
      quotes: items.slice(0, 2),
    }));
};

const buildOutline = (topic: string, painPoints: string[]): string[] => [
  `Why ${topic} matters right now`,
  painPoints[0] ?? `Hidden friction creators face with ${topic}`,
  painPoints[1] ?? `Quick win to move on ${topic} today`,
  painPoints[2] ?? `Story from the field about ${topic}`,
  `Prompt your audience with an open question on ${topic}`,
];

const clampVirality = (value: number): number => {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const sanitizeHook = (hook: string): string => {
  const normalized = normalizeWhitespace(hook);
  if (!normalized) {
    return 'Fresh angle worth sharing';
  }

  const { text } = truncateWords(normalized, HOOK_WORD_LIMIT);
  return text;
};

const sanitizeTrendNotes = (notes: string[]): string[] =>
  notes.slice(0, 5).map((note) => clampVisibleLength(normalizeWhitespace(note), 140).text);

const sanitizeOutline = (outline: string[], topic: string): string[] => {
  const sanitized = outline
    .map((line) => clampVisibleLength(normalizeWhitespace(line), 140).text)
    .filter((line) => line.length > 0);

  const unique = Array.from(new Set(sanitized));
  const filled = [...unique];

  let fillerIndex = 0;
  while (filled.length < 5) {
    const filler =
      OUTLINE_FILLERS[fillerIndex % OUTLINE_FILLERS.length] ||
      `Ask your audience how they approach ${topic}.`;
    filled.push(filler);
    fillerIndex += 1;
  }

  return filled.slice(0, 7);
};

const sanitizeIdeaItem = (
  topic: string,
  item: IdeasResponse['ideas'][number]['items'][number],
) => {
  const hook = sanitizeHook(item.hook);
  const outline = sanitizeOutline(item.mini_outline, topic);

  return {
    hook,
    mini_outline: outline,
    virality_score: clampVirality(item.virality_score),
    recommended_time: item.recommended_time ?? 'morning',
  };
};

const sanitizeTopic = (idea: IdeasResponse['ideas'][number]) => {
  const normalizedTopic = normalizeWhitespace(idea.topic || 'Audience pulse');
  const items = idea.items
    .map((item) => sanitizeIdeaItem(normalizedTopic, item))
    .reduce((acc, item) => {
      const key = stableObjectHash({ topic: normalizedTopic, hook: item.hook });
      if (!acc.index.has(key)) {
        acc.index.add(key);
        acc.items.push(item);
      }
      return acc;
    }, { index: new Set<string>(), items: [] as IdeasResponse['ideas'][number]['items'] }).items;

  if (items.length === 0) {
    items.push(
      sanitizeIdeaItem(normalizedTopic, {
        hook: `Fresh angle on ${normalizedTopic}`,
        mini_outline: buildOutline(normalizedTopic, []),
        virality_score: 55,
        recommended_time: 'morning',
      }),
    );
  }

  return {
    topic: normalizedTopic,
    trend_notes: sanitizeTrendNotes(idea.trend_notes ?? []),
    items,
  };
};

const collapseTopics = (topics: IdeasResponse['ideas']): IdeasResponse['ideas'] => {
  const map = new Map<string, IdeasResponse['ideas'][number]>();

  for (const topic of topics) {
    const existing = map.get(topic.topic);
    if (!existing) {
      map.set(topic.topic, { ...topic });
      continue;
    }

    const mergedItems = [...existing.items];
    for (const item of topic.items) {
      const key = stableObjectHash({ topic: topic.topic, hook: item.hook });
      if (!mergedItems.some((existingItem) => stableObjectHash({ topic: topic.topic, hook: existingItem.hook }) === key)) {
        mergedItems.push(item);
      }
    }

    map.set(topic.topic, {
      ...existing,
      items: mergedItems.slice(0, 3),
    });
  }

  return Array.from(map.values());
};

const buildFallbackTopics = (snippets: string[], desiredCount: number): IdeasResponse['ideas'] => {
  if (desiredCount <= 0) {
    return [];
  }

  const clusters = fallbackCluster(snippets);
  const topics: IdeasResponse['ideas'] = clusters.map((cluster) =>
    sanitizeTopic({
      topic: cluster.topic,
      trend_notes: [],
      items: [
        {
          hook: `Fresh angle on ${cluster.topic}`,
          mini_outline: buildOutline(cluster.topic, cluster.pain_points),
          virality_score: 55,
          recommended_time: 'morning',
        },
      ],
    }),
  );

  const genericFallbacks = [
    'Momentum check-in',
    'Audience friction audit',
    'Behind-the-scenes builder note',
  ];

  let fillerIndex = 0;
  while (topics.length < desiredCount) {
    const label = genericFallbacks[fillerIndex % genericFallbacks.length];
    topics.push(
      sanitizeTopic({
        topic: label,
        trend_notes: [],
        items: [
          {
            hook: `Share a ${label.toLowerCase()}`,
            mini_outline: buildOutline(label, []),
            virality_score: 52,
            recommended_time: 'afternoon',
          },
        ],
      }),
    );
    fillerIndex += 1;
  }

  return topics.slice(0, desiredCount);
};

const normalizeIdeasPayload = (
  raw: IdeasResponse,
  snippets: string[],
  fallbackSources: Array<{ name: string; url?: string }>,
) => {
  const sanitized = collapseTopics(raw.ideas.map(sanitizeTopic));
  const trimmed = sanitized.slice(0, MAX_IDEA_COUNT);

  const ensured =
    trimmed.length >= MIN_IDEA_COUNT
      ? trimmed
      : [
          ...trimmed,
          ...buildFallbackTopics(snippets, MIN_IDEA_COUNT - trimmed.length),
        ].slice(0, MAX_IDEA_COUNT);

  const parsed = IdeasResponseSchema.safeParse({
    ideas: ensured,
    sources_used: raw.sources_used?.length ? raw.sources_used : fallbackSources,
  });

  if (!parsed.success) {
    throw new Error('Ideas payload failed post-normalization validation');
  }

  return parsed.data;
};

const safeSnippets = (snippets: string[]): string[] =>
  snippets.slice(0, 30).map((item) => clipText(item, 240));

export const generateIdeas = async (
  env: EnvBindings,
  request: IdeasRequest,
  options: { userId: string },
): Promise<IdeaEngineResult> => {
  const parsed = IdeasRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error('Invalid request body');
  }

  const userId = options.userId;
  const wantTrends = parsed.data.want_trends;

  const snippets = safeSnippets(parsed.data.snippets);
  let clusters: ClusterResponseOutput;

  try {
    clusters = await clusterSnippetsWithOpenAI(env, snippets);
  } catch {
    clusters = fallbackCluster(snippets);
  }

  let trendNotes: string[] = [];
  let sourcesUsed: Array<{ name: string; url?: string }> = [];
  let estimatedTrendCost = 0;

  if (parsed.data.want_trends) {
    try {
      const trendResult = await fetchTrendSparks(env, clusters, parsed.data.trend_sources_max ?? 1);
      trendNotes = trendResult.trend_notes;
      sourcesUsed = trendResult.sources_used;
      estimatedTrendCost = trendResult.estimated_cost_usd;
      if (sourcesUsed.length > 0) {
        console.log('[xai-trends]', {
          sources_used: sourcesUsed.map((source) => source.name),
          estimated_cost_usd: estimatedTrendCost,
        });
      }
    } catch (error) {
      console.warn('[xai-trends] failed', error);
      trendNotes = [];
    }
  }

  const attempts = [
    { temperature: 0.2, reminder: undefined },
    { temperature: 0.1, reminder: 'STRICT JSON ONLY, NO PROSE.' },
  ];

  for (const attempt of attempts) {
    try {
      const ideas = await generateIdeasWithOpenAI(
        env,
        {
          snippets,
          style_profile: parsed.data.style_profile,
          clusters,
          trend_notes: trendNotes,
        },
        { temperature: attempt.temperature, systemReminder: attempt.reminder },
      );

      const normalized = normalizeIdeasPayload(ideas, snippets, sourcesUsed);
      const sourcesUsedCount = normalized.sources_used?.length ?? sourcesUsed.length ?? 0;
      const trendsUsed = wantTrends && (trendNotes.length > 0 || sourcesUsedCount > 0);

      if (wantTrends && userId && userId !== 'anonymous') {
        recordTrendUsage(userId, trendsUsed ? estimatedTrendCost : 0, Date.now());
      }

      return {
        response: normalized,
        sources_used: normalized.sources_used ?? sourcesUsed,
        metrics: {
          trendCost: trendsUsed ? estimatedTrendCost : 0,
          trendCalls: wantTrends ? 1 : 0,
          trendsUsed,
          sourcesUsedCount,
        },
      };
    } catch (error) {
      // Continue to next attempt
      console.warn('[ideaengine] generation attempt failed', { attempt: attempt.reminder ?? 'primary', error });
    }
  }

  const liteIdeas = {
    ideas: buildFallbackTopics(snippets, Math.max(LITE_IDEA_MIN, MIN_IDEA_COUNT)),
    sources_used: [],
  };

  const normalizedLite = normalizeIdeasPayload(liteIdeas, snippets, []);

  if (wantTrends && userId && userId !== 'anonymous') {
    recordTrendUsage(userId, 0, Date.now());
  }

  return {
    response: normalizedLite,
    sources_used: normalizedLite.sources_used ?? [],
    metrics: {
      trendCost: 0,
      trendCalls: wantTrends ? 1 : 0,
      trendsUsed: false,
      sourcesUsedCount: normalizedLite.sources_used?.length ?? 0,
    },
  };
};
