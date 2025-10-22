import { z } from 'zod';
import type { ClusterResponseOutput } from '@pulse-kit/shared';
import type { EnvBindings } from '../../env.js';
import { trendsJsonSchema } from './jsonSchemas.js';

const XAI_URL = 'https://api.x.ai/v1/chat/completions';

interface JsonCallOptions {
  env: EnvBindings;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  jsonSchema: unknown;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
  tools?: unknown[];
}

const trendSchema = z.object({
  trend_notes: z.array(z.string()).max(5),
  sources_used: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url().optional(),
      }),
    )
    .max(3),
});

const buildBody = (options: JsonCallOptions) => ({
  model: options.model ?? 'grok-1.5-mini',
  temperature: options.temperature ?? 0.2,
  max_tokens: options.maxTokens ?? 800,
  messages: options.messages.map((message) => ({
    role: message.role,
    content: [{ type: 'text', text: message.content }],
  })),
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'pulse_trends',
      schema: options.jsonSchema,
      strict: true,
    },
  },
  tools: options.tools ?? [{ type: 'web_search' }],
});

const callXaiJson = async (options: JsonCallOptions): Promise<unknown> => {
  const key = options.env.XAI_API_KEY;
  if (!key) {
    throw new Error('XAI_API_KEY is not configured');
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const maxAttempts = (options.retries ?? 1) + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(XAI_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildBody(options)),
    });

    if (!response.ok) {
      if (attempt === maxAttempts) {
        throw new Error(`xAI request failed (${response.status})`);
      }
      continue;
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content?.[0]?.text ?? payload.output_text;
    if (typeof content !== 'string') {
      if (attempt === maxAttempts) {
        throw new Error('Missing text content in xAI response');
      }
      continue;
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw new Error('xAI call exhausted retries');
};

export const fetchTrendSparks = async (
  env: EnvBindings,
  clusters: ClusterResponseOutput,
  limit: number,
): Promise<{ trend_notes: string[]; sources_used: Array<{ name: string; url?: string }> }> => {
  if (!env.XAI_API_KEY || limit === 0) {
    return { trend_notes: [], sources_used: [] };
  }

  const payload = await callXaiJson({
    env,
    messages: [
      {
        role: 'system',
        content:
          'You are TrendSpark, surfacing breaking insights for social creators. Return strict JSON.',
      },
      {
        role: 'user',
        content: `Analyze these clusters JSON: ${JSON.stringify(
          clusters,
        )}. Provide up to ${limit} timely sparks referencing current X or news context.`,
      },
    ],
    jsonSchema: trendsJsonSchema,
    maxTokens: 600,
    retries: 1,
    tools: [{ type: 'web_search', web_search: { enable_multi_step_thinking: true } }],
  });

  const parsed = trendSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Trend sparks payload failed validation');
  }

  return parsed.data;
};
