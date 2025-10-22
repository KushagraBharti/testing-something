import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { extractTimelineSnippets, extractTweetSnippet } from "@pulse-kit/shared";

const buildDom = (html: string) => {
  const dom = new JSDOM(html);
  return dom.window.document;
};

describe("DOM selectors", () => {
  it("extracts snippets from a timeline", () => {
    const doc = buildDom(`
      <div data-testid="cellInnerDiv">
        <div data-testid="tweetText">First tweet about builders.</div>
      </div>
      <div data-testid="cellInnerDiv">
        <div data-testid="tweetText">Second tweet about idea flow.</div>
      </div>
    `);

    const snippets = extractTimelineSnippets(doc, "home", 30);
    expect(snippets).toHaveLength(2);
    expect(snippets[0]).toMatch(/First tweet/);
  });

  it("extracts main tweet snippet", () => {
    const doc = buildDom(`
      <article data-testid="tweet">
        <div data-testid="tweetText">Main tweet body here.</div>
      </article>
    `);

    const snippet = extractTweetSnippet(doc);
    expect(snippet).toContain("Main tweet");
  });
});
