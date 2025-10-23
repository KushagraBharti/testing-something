const WORD_BOUNDARY_REGEX = /\s+/g;
const PRESENTATION_MODIFIER_REGEX = /[\u200B-\u200D\u2060\uFE0E\uFE0F]/g;

export const normalizeWhitespace = (input: string): string =>
  input.replace(/\s+/g, ' ').trim();

export const clipText = (input: string, maxLength = 240): string => {
  const normalized = normalizeWhitespace(input);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength - 1).trimEnd() + '...';
};

export const estimateTokens = (input: string): number =>
  Math.max(1, Math.round(normalizeWhitespace(input).length / 4));

export const chunkSnippets = (snippets: string[], maxTokens = 1200): string[][] => {
  const buckets: string[][] = [];
  let current: string[] = [];
  let tokenCount = 0;

  for (const snippet of snippets) {
    const clipped = clipText(snippet);
    const tokens = estimateTokens(clipped);

    if (tokenCount + tokens > maxTokens && current.length > 0) {
      buckets.push(current);
      current = [];
      tokenCount = 0;
    }

    current.push(clipped);
    tokenCount += tokens;
  }

  if (current.length > 0) {
    buckets.push(current);
  }

  return buckets;
};

export const detectLanguage = (input: string): string => {
  const asciiMatches = input.match(/[A-Za-z]/g)?.length ?? 0;
  const totalChars = [...input].length || 1;
  const ratio = asciiMatches / totalChars;

  if (ratio > 0.6) return 'en';
  if (ratio > 0.3) return 'mixed';
  return 'other';
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(',')}}`;
};

export const stableObjectHash = (value: unknown): string => {
  const serialized = stableStringify(value);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = (hash * 16777619) >>> 0;
  }

  return hash.toString(16);
};

export const tokenizeWords = (input: string): string[] =>
  normalizeWhitespace(input)
    .split(WORD_BOUNDARY_REGEX)
    .filter(Boolean);

export const countWords = (input: string): number => tokenizeWords(input).length;

const visibleCharacters = (input: string): string[] =>
  Array.from(input.replace(/\r?\n/g, ' '));

export const truncateWords = (input: string, maxWords: number): { text: string; truncated: boolean } => {
  const words = tokenizeWords(input);
  if (words.length <= maxWords) {
    return { text: normalizeWhitespace(input), truncated: false };
  }

  const clipped = words.slice(0, maxWords).join(' ');
  return { text: `${clipped}…`, truncated: true };
};

export const stripVariantSelectors = (input: string): string =>
  input.replace(PRESENTATION_MODIFIER_REGEX, '');

export const clampVisibleLength = (
  input: string,
  max: number,
): { text: string; truncated: boolean } => {
  const normalized = normalizeWhitespace(input);
  if (stripVariantSelectors(normalized).length <= max) {
    return { text: normalized, truncated: false };
  }

  const builder: string[] = [];
  let count = 0;
  let truncated = false;

  for (const char of visibleCharacters(normalized)) {
    const visible = stripVariantSelectors(char);
    const delta = visible.length;
    if (delta === 0) {
      builder.push(char);
      continue;
    }
    if (count + delta > max) {
      truncated = true;
      break;
    }
    builder.push(char);
    count += delta;
  }

  const result = builder.join('').trimEnd();
  return {
    text: truncated ? `${result}…` : result,
    truncated,
  };
};
