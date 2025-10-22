import type { SelectorConfig } from './types.js';
import { clipText, normalizeWhitespace } from './utils.js';

export type SelectorKey = 'home' | 'mentions' | 'tweet' | 'messages';

const createSelector = (config: SelectorConfig): SelectorConfig => config;

export const SELECTOR_MAP: Record<SelectorKey, SelectorConfig> = {
  home: createSelector({
    name: 'home',
    maxItems: 30,
    itemSelector: 'div[data-testid="cellInnerDiv"]',
    contentSelector: 'div[data-testid="tweetText"]',
    fallbackSelectors: [
      'article[role="article"] div[data-testid="tweetText"]',
      'div[data-testid="tweet"] div[lang]',
    ],
  }),
  mentions: createSelector({
    name: 'mentions',
    maxItems: 30,
    itemSelector: 'div[data-testid="cellInnerDiv"]',
    contentSelector: 'div[data-testid="tweetText"]',
    fallbackSelectors: ['article[role="article"] div[lang]'],
  }),
  tweet: createSelector({
    name: 'tweet',
    maxItems: 1,
    itemSelector: 'article[data-testid="tweet"]',
    contentSelector: 'div[data-testid="tweetText"]',
    fallbackSelectors: ['article[data-testid="tweet"] div[lang]'],
  }),
  messages: createSelector({
    name: 'messages',
    maxItems: 30,
    itemSelector: '*[data-testid*="messageEntry"], div[role="article"]',
    contentSelector: '*[data-testid="messageEntry"] div[dir="auto"], div[role="article"] div[dir="auto"]',
    fallbackSelectors: ['div[role="listitem"] div[dir="auto"]'],
  }),
};

const toElements = (root: ParentNode, selector: string): Element[] => {
  if (!selector) {
    return [];
  }

  const queryRoot = root as Document | Element | DocumentFragment;
  return Array.from(queryRoot.querySelectorAll(selector));
};

const readElementText = (element: Element | null): string => {
  if (!element) {
    return '';
  }

  if ('innerText' in element) {
    return normalizeWhitespace((element as HTMLElement).innerText);
  }

  return normalizeWhitespace(element.textContent ?? '');
};

const collectUsingConfig = (
  root: ParentNode,
  config: SelectorConfig,
  limit: number,
): string[] => {
  const items = toElements(root, config.itemSelector);
  const snippets: string[] = [];

  for (const item of items) {
    const contentNode = item.querySelector(config.contentSelector);
    const raw = contentNode ? readElementText(contentNode) : readElementText(item);

    if (raw) {
      snippets.push(clipText(raw, 240));
    }

    if (snippets.length >= Math.min(limit, config.maxItems)) {
      break;
    }
  }

  if (snippets.length === 0 && config.fallbackSelectors?.length) {
    for (const fallback of config.fallbackSelectors) {
      const fallbackNodes = toElements(root, fallback);
      for (const node of fallbackNodes) {
        const text = readElementText(node);
        if (text) {
          snippets.push(clipText(text, 240));
        }
        if (snippets.length >= Math.min(limit, config.maxItems)) {
          break;
        }
      }
      if (snippets.length > 0) {
        break;
      }
    }
  }

  return snippets;
};

export const extractTimelineSnippets = (
  root: ParentNode,
  key: 'home' | 'mentions' = 'home',
  limit = 30,
): string[] => collectUsingConfig(root, SELECTOR_MAP[key], limit);

export const extractTweetSnippet = (root: ParentNode): string | null => {
  const snippets = collectUsingConfig(root, SELECTOR_MAP.tweet, 1);
  return snippets.length ? snippets[0]! : null;
};

export const extractMessageSnippets = (root: ParentNode, limit = 30): string[] =>
  collectUsingConfig(root, SELECTOR_MAP.messages, limit);

export type PageContext = 'home' | 'mentions' | 'tweet' | 'messages' | 'unknown';

export const inferPageContext = (url: string): PageContext => {
  try {
    const parsed = new URL(url, 'https://x.com');
    const path = parsed.pathname;

    if (path === '/' || path.startsWith('/home')) return 'home';
    if (path.startsWith('/notifications') || path.startsWith('/mentions')) return 'mentions';
    if (path.includes('/status/')) return 'tweet';
    if (path.startsWith('/messages')) return 'messages';
  } catch (error) {
    // no-op: fall through to unknown
  }

  return 'unknown';
};

