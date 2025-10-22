import {
  ClusterResponseSchema,
  IdeasResponseSchema,
  RepliesResponseSchema,
  type ClusterResponseOutput,
  type IdeasResponseOutput,
  type RepliesResponseOutput,
} from '@pulse-kit/shared';
import {
  CLUSTER_SYSTEM_PROMPT,
  IDEAS_USER_PROMPT,
  REPLIES_USER_PROMPT,
} from '@pulse-kit/shared';
import type { EnvBindings } from '../../env.js';
import {
  clustersJsonSchema,
  ideasJsonSchema,
  repliesJsonSchema,
} from './jsonSchemas.js';

type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

interface JsonCallOptions {
  env: EnvBindings;
  messages: ChatMessage[];
  jsonSchema: unknown;
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  maxTokens?: number;
  retries?: number;
}

const OPENAI_URL = 'https://api.openai.com/v1/responses';

const toOpenAIInput = (messages: ChatMessage[]) =>
  messages.map((message) => ({
    role: message.role,
    content: [
      {
        type: 'text',
        text: message.content,
      },
    ],
  }));

const buildBody = (options: JsonCallOptions) => ({
  model: options.model ?? 'gpt-4.1-mini',
  temperature: options.temperature ?? 0.2,
  max_output_tokens: options.maxTokens ?? 1200,
  input: toOpenAIInput(options.messages),
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'pulse_kit',
      schema: options.jsonSchema,
      strict: true,
    },
  },
});

const extractJsonText = (payload: any): string => {
  const candidates = [
    payload.output_text,
    payload.output?.[0]?.content?.[0]?.text,
    payload.choices?.[0]?.message?.content?.[0]?.text,
    payload.choices?.[0]?.message?.content,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  throw new Error('Unable to locate JSON payload in OpenAI response');
};

const callOpenAiJson = async (options: JsonCallOptions): Promise<unknown> => {
  const key = options.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const maxAttempts = (options.retries ?? 1) + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildBody(options)),
      signal: options.signal,
    });

    if (!response.ok) {
      if (attempt === maxAttempts) {
        throw new Error(`OpenAI request failed (${response.status})`);
      }
      continue;
    }

    try {
      const payload = await response.json();
      const text = extractJsonText(payload);
      return JSON.parse(text);
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw new Error('OpenAI call exhausted retries');
};

export const clusterSnippetsWithOpenAI = async (
  env: EnvBindings,
  snippets: string[],
): Promise<ClusterResponseOutput> => {
  const prompt = `Snippets JSON: ${JSON.stringify(snippets)}`;

  const result = await callOpenAiJson({
    env,
    messages: [
      { role: 'system', content: CLUSTER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    jsonSchema: clustersJsonSchema,
    maxTokens: 800,
    retries: 1,
  });

  const parsed = ClusterResponseSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error('Cluster payload failed validation');
  }

  return parsed.data;
};

export const generateIdeasWithOpenAI = async (
  env: EnvBindings,
  payload: {
    snippets: string[];
    style_profile: unknown;
    clusters: ClusterResponseOutput;
    trend_notes: string[];
  },
): Promise<IdeasResponseOutput> => {
  const { snippets, style_profile, clusters, trend_notes } = payload;
  const userPrompt = `${IDEAS_USER_PROMPT}
Clusters JSON: ${JSON.stringify(clusters)}
Snippets JSON: ${JSON.stringify(snippets)}
Style Profile JSON: ${JSON.stringify(style_profile)}
Trend Notes JSON: ${JSON.stringify(trend_notes)}`;

  const result = await callOpenAiJson({
    env,
    messages: [
      {
        role: 'system',
        content: 'You are IdeaEngine, a strategist who returns strict JSON.',
      },
      { role: 'user', content: userPrompt },
    ],
    jsonSchema: ideasJsonSchema,
    maxTokens: 1600,
    retries: 1,
  });

  const parsed = IdeasResponseSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error('Ideas payload failed validation');
  }

  return parsed.data;
};

export const generateRepliesWithOpenAI = async (
  env: EnvBindings,
  payload: {
    tweet_text: string;
    context_summary: string | null;
    style_profile: unknown;
  },
): Promise<RepliesResponseOutput> => {
  const userPrompt = `${REPLIES_USER_PROMPT}
Tweet Payload JSON: ${JSON.stringify(payload)}`;

  const result = await callOpenAiJson({
    env,
    messages: [
      {
        role: 'system',
        content: 'You are ReplyCopilot, crafting concise on-brand replies.',
      },
      { role: 'user', content: userPrompt },
    ],
    jsonSchema: repliesJsonSchema,
    maxTokens: 400,
    retries: 1,
  });

  const parsed = RepliesResponseSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error('Replies payload failed validation');
  }

  return parsed.data;
};
