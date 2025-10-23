import type { SelectorConfig } from "./types.js";
import { clipText, normalizeWhitespace } from "./utils.js";

export type SelectorKey = "home" | "mentions" | "tweet" | "messages";

export interface SelectorVariant {
  label: string;
  selector: string;
}

export interface SelectorEntry extends SelectorConfig {
  primary: SelectorVariant;
  fallbacks: SelectorVariant[];
}

export interface SelectorDiagnostics {
  label: string;
  selector: string;
  matches: number;
}

const createSelector = (
  config: SelectorConfig & { primary: SelectorVariant; fallbacks: SelectorVariant[] },
): SelectorEntry => config;

export const SELECTOR_MAP: Record<SelectorKey, SelectorEntry> = {
  home: createSelector({
    name: "home",
    maxItems: 30,
    itemSelector: "",
    contentSelector: "",
    primary: {
      label: "Timeline primary",
      selector: 'div[data-testid="cellInnerDiv"] div[data-testid="tweetText"]',
    },
    fallbacks: [
      {
        label: "Timeline fallback",
        selector: 'article[data-testid="tweet"] div[lang] ',
      },
    ],
  }),
  mentions: createSelector({
    name: "mentions",
    maxItems: 30,
    itemSelector: "",
    contentSelector: "",
    primary: {
      label: "Mentions primary",
      selector: 'div[data-testid="cellInnerDiv"] div[data-testid="tweetText"]',
    },
    fallbacks: [
      {
        label: "Mentions fallback",
        selector: 'article[data-testid="tweet"] div[lang] ',
      },
    ],
  }),
  tweet: createSelector({
    name: "tweet",
    maxItems: 1,
    itemSelector: "",
    contentSelector: "",
    primary: {
      label: "Tweet primary",
      selector: 'article[data-testid="tweet"] div[data-testid="tweetText"]',
    },
    fallbacks: [
      {
        label: "Tweet fallback",
        selector: 'article[role="article"] div[lang] ',
      },
    ],
  }),
  messages: createSelector({
    name: "messages",
    maxItems: 30,
    itemSelector: "",
    contentSelector: "",
    primary: {
      label: "DM primary",
      selector: '[data-testid*="messageEntry"] div[dir="auto"]',
    },
    fallbacks: [
      {
        label: "DM fallback",
        // Some DM layouts place mirrored text nodes next to a textbox. Scan siblings.
        selector: '[role="textbox"] ~ div[dir="auto"]',
      },
    ],
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
    return "";
  }

  if ("innerText" in element) {
    return normalizeWhitespace((element as HTMLElement).innerText);
  }

  return normalizeWhitespace(element.textContent ?? "");
};

const collectUsingEntry = (
  root: ParentNode,
  config: SelectorEntry,
  limit: number,
): { snippets: string[]; diagnostics: SelectorDiagnostics[] } => {
  const variants = [config.primary, ...config.fallbacks];
  const snippets: string[] = [];
  const diagnostics: SelectorDiagnostics[] = [];
  const seen = new Set<string>();
  const max = Math.min(limit, config.maxItems);

  for (const variant of variants) {
    const nodes = toElements(root, variant.selector);
    diagnostics.push({
      label: variant.label,
      selector: variant.selector,
      matches: nodes.length,
    });

    for (const node of nodes) {
      if (snippets.length >= max) {
        break;
      }

      const text = clipText(readElementText(node), 240);
      if (!text || seen.has(text)) {
        continue;
      }

      seen.add(text);
      snippets.push(text);
    }

    if (snippets.length >= max) {
      break;
    }
  }

  return { snippets, diagnostics };
};

export const collectSnippetsWithDebug = (
  root: ParentNode,
  key: SelectorKey,
  limit = 30,
): { snippets: string[]; diagnostics: SelectorDiagnostics[] } =>
  collectUsingEntry(root, SELECTOR_MAP[key], limit);

export const extractTimelineSnippets = (
  root: ParentNode,
  key: "home" | "mentions" = "home",
  limit = 30,
): string[] => collectUsingEntry(root, SELECTOR_MAP[key], limit).snippets;

export const extractTweetSnippet = (root: ParentNode): string | null => {
  const { snippets } = collectUsingEntry(root, SELECTOR_MAP.tweet, 1);
  return snippets.length ? snippets[0]! : null;
};

export const extractMessageSnippets = (root: ParentNode, limit = 30): string[] =>
  collectUsingEntry(root, SELECTOR_MAP.messages, limit).snippets;

export type PageContext = "home" | "mentions" | "tweet" | "messages" | "unknown";

export const inferPageContext = (url: string): PageContext => {
  try {
    const parsed = new URL(url, "https://x.com");
    const path = parsed.pathname;

    if (path === "/" || path.startsWith("/home")) return "home";
    if (path.startsWith("/notifications") || path.startsWith("/mentions")) return "mentions";
    if (path.includes("/status/")) return "tweet";
    if (path.startsWith("/messages")) return "messages";
  } catch (error) {
    // no-op
  }

  return "unknown";
};
