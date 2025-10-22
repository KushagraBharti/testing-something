import { describe, expect, it } from 'vitest';
import {
  chunkSnippets,
  clipText,
  detectLanguage,
  estimateTokens,
  normalizeWhitespace,
  stableObjectHash,
  tokenizeWords,
} from '../src/utils.js';

describe('text utilities', () => {
  it('normalizes whitespace and clips text', () => {
    const original = 'Hello   world   from  IdeaEngine';
    expect(normalizeWhitespace(original)).toBe('Hello world from IdeaEngine');
    expect(clipText(original, 10)).toBe('Hello wor...');
  });

  it('estimates tokens roughly by character length', () => {
    expect(estimateTokens('short text')).toBeGreaterThan(1);
  });

  it('chunks snippets into token-aware batches', () => {
    const buckets = chunkSnippets(new Array(100).fill('snippet text'), 50);
    expect(buckets.length).toBeGreaterThan(1);
  });

  it('detects language heuristically', () => {
    expect(detectLanguage('Hello friends this is a test')).toBe('en');
    expect(detectLanguage('\u4f60\u597d')).toBe('other');
  });

  it('creates a stable hash for objects', () => {
    const hashA = stableObjectHash({ b: 2, a: 1 });
    const hashB = stableObjectHash({ a: 1, b: 2 });
    expect(hashA).toBe(hashB);
  });

  it('tokenizes words', () => {
    expect(tokenizeWords('Hello, world!')).toEqual(['Hello,', 'world!']);
  });
});
