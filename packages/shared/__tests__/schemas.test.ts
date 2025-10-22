import { describe, expect, it } from 'vitest';
import {
  IdeasRequestSchema,
  IdeasResponseSchema,
  RepliesRequestSchema,
  RepliesResponseSchema,
  StyleProfileRequestSchema,
  StyleProfileSchema,
} from '../src/schemas.js';

const styleProfile = {
  voice: 'Bold, curious, optimistic tech analyst',
  cadence: 'Snappy sentences with occasional rhetorical questions.',
  sentence_length: '1–2 short sentences per thought.',
  favorite_phrases: ['zoom in', 'for builders', 'real talk'],
  banned_words: ['cringe', 'AI overlords'],
};

describe('StyleProfileSchema', () => {
  it('validates a complete style profile', () => {
    const result = StyleProfileSchema.safeParse(styleProfile);
    expect(result.success).toBe(true);
  });

  it('rejects overly long favorite phrases', () => {
    const result = StyleProfileSchema.safeParse({
      ...styleProfile,
      favorite_phrases: ['a'.repeat(200)],
    });
    expect(result.success).toBe(false);
  });
});

describe('IdeasRequestSchema', () => {
  it('accepts a minimal valid request', () => {
    const result = IdeasRequestSchema.safeParse({
      snippets: ['First snippet', 'Second snippet'],
      style_profile: styleProfile,
      want_trends: false,
      niche: null,
      trend_sources_max: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects snippets that exceed 240 chars', () => {
    const result = IdeasRequestSchema.safeParse({
      snippets: ['a'.repeat(241)],
      style_profile: styleProfile,
      want_trends: false,
      niche: null,
      trend_sources_max: 1,
    });

    expect(result.success).toBe(false);
  });
});

describe('IdeasResponseSchema', () => {
  it('validates a properly structured response', () => {
    const result = IdeasResponseSchema.safeParse({
      ideas: [
        {
          topic: 'AI productivity rituals',
          trend_notes: ['Open-source copilots gaining traction'],
          items: [
            {
              hook: 'Unlock your creative ritual before sunrise',
              mini_outline: [
                'Stack a 15-minute curiosity sprint with Focus mode',
                'Mix analog + AI notes for sparks',
                'Archive friction with a nightly inbox zero ritual',
                'Ship a micro-take daily to stay visible',
                'Close with a reflective question to your crew',
              ],
              virality_score: 72,
              recommended_time: 'morning',
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe('Replies schemas', () => {
  it('require exactly three replies', () => {
    const result = RepliesResponseSchema.safeParse({
      replies: ['Nice take', 'What about the layer2 angle?', 'Here is how I applied it'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects overlong replies', () => {
    const result = RepliesResponseSchema.safeParse({
      replies: [
        'a'.repeat(181),
        'Concise question?',
        'Concise example.',
      ],
    });
    expect(result.success).toBe(false);
  });

  it('requires tweet text input', () => {
    const result = RepliesRequestSchema.safeParse({
      tweet_text: '',
      context_summary: null,
      style_profile: styleProfile,
    });

    expect(result.success).toBe(false);
  });
});

describe('StyleProfileRequestSchema', () => {
  it('needs at least three posts', () => {
    const result = StyleProfileRequestSchema.safeParse({
      user_posts: ['One', 'Two'],
    });
    expect(result.success).toBe(false);
  });
});
