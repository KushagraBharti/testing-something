

import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';
import { createJwt } from '../src/lib/jwt.js';
import { resolveEnv } from '../src/env.js';

const env = resolveEnv({ JWT_SECRET: 'test-secret' });

vi.mock('../src/services/providers/openai.js', () => ({
  clusterSnippetsWithOpenAI: vi.fn().mockResolvedValue([
    { topic: 'ai agents', pain_points: ['tooling gap'], quotes: ['agents snippet'] },
  ]),
  generateIdeasWithOpenAI: vi.fn().mockResolvedValue({
    ideas: [
      {
        topic: 'ai agents',
        trend_notes: [],
        items: [
          {
            hook: 'Agent skills to ship now',
            mini_outline: ['Point', 'Proof', 'Question', 'CTA', 'Bonus'],
            virality_score: 72,
            recommended_time: 'morning',
          },
        ],
      },
    ],
  }),
  generateRepliesWithOpenAI: vi.fn(),
}));

vi.mock('../src/services/providers/xai.js', () => ({
  fetchTrendSparks: vi.fn().mockResolvedValue({ trend_notes: [], sources_used: [] }),
}));

const buildAuthHeader = async () => {
  const token = await createJwt({ sub: 'user-1', scope: ['ideas'] }, env);
  return `Bearer ${token}`;
};

const makeJsonRequest = (url: string, options: { method?: string; headers?: HeadersInit; body?: unknown }) => {
  const init: RequestInit = {
    method: options.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  return new Request(url, init);
};

describe('IdeaEngine route', () => {
  let authHeader: string;

  beforeEach(async () => {
    authHeader = await buildAuthHeader();
  });

  it('rejects missing auth header', async () => {
    const request = makeJsonRequest('http://localhost/ai/ideas', { body: {} });
    const response = await app.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it('returns ideas payload', async () => {
    const request = makeJsonRequest('http://localhost/ai/ideas', {
      headers: { Authorization: authHeader },
      body: {
        snippets: ['AI agents will change growth loops.'],
        style_profile: {
          voice: 'Energetic',
          cadence: 'Quick hits',
          sentence_length: 'Short bursts',
          favorite_phrases: ['ship it'],
          banned_words: [],
        },
        want_trends: false,
        niche: null,
        trend_sources_max: 1,
      },
    });

    const response = await app.fetch(request, env);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ideas?.length).toBeGreaterThan(0);
  });
});
