import {
  StyleProfileRequestSchema,
  StyleProfileSchema,
  tokenizeWords,
  type StyleProfile,
} from '@pulse-kit/shared';

const topTerms = (tokens: string[], limit: number): string[] => {
  const counts = new Map<string, number>();
  tokens.forEach((token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token)
    .filter(Boolean);
};

const averageSentenceLength = (posts: string[]): string => {
  const sentences = posts
    .flatMap((post) => post.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean));
  if (sentences.length === 0) {
    return 'Short sentences';
  }

  const totalWords = sentences.reduce(
    (sum, sentence) => sum + tokenizeWords(sentence).length,
    0,
  );
  const avg = Math.round(totalWords / sentences.length);

  if (avg <= 10) return 'Short bursts';
  if (avg <= 18) return 'Medium length';
  return 'Long-form cadence';
};

export const deriveStyleProfile = (userPosts: string[]): StyleProfile => {
  const tokens = tokenizeWords(userPosts.join(' ').toLowerCase());
  const frequentTerms = topTerms(tokens, 5);
  const headlineTerms = frequentTerms.slice(0, 2).join(' and ') || 'momentum';

  const voice = `Energetic creator focused on ${headlineTerms}`;
  const cadence = frequentTerms.includes('ship')
    ? 'Action-first builder cadence'
    : 'Conversational and direct';
  const favoritePhrases = frequentTerms.map((term) => `Keep ${term} sharp`);

  return StyleProfileSchema.parse({
    voice,
    cadence,
    sentence_length: averageSentenceLength(userPosts),
    favorite_phrases: favoritePhrases,
    banned_words: [],
  });
};

export const buildStyleProfile = (body: unknown): StyleProfile => {
  const parsed = StyleProfileRequestSchema.parse(body);
  return deriveStyleProfile(parsed.user_posts);
};
