import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { collectSnippetsWithDebug, extractTweetSnippet } from "@pulse-kit/shared";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf-8");

describe("selector fallbacks", () => {
  it("captures timeline using primary selector", () => {
    const dom = new JSDOM(fixture("timeline-primary.html"));
    const { snippets, diagnostics } = collectSnippetsWithDebug(dom.window.document, "home", 30);
    expect(snippets).toEqual([
      "Primary selector tweet text one.",
      "Primary selector tweet text two.",
    ]);
    expect(diagnostics[0]).toEqual(
      expect.objectContaining({ label: "Timeline primary", matches: 2 }),
    );
  });

  it("falls back when primary selector misses", () => {
    const dom = new JSDOM(fixture("timeline-fallback.html"));
    const { snippets, diagnostics } = collectSnippetsWithDebug(dom.window.document, "home", 30);
    expect(snippets).toEqual([
      "Fallback tweet content alpha.",
      "Fallback tweet content beta.",
    ]);
    expect(diagnostics[0].matches).toBe(0);
    expect(diagnostics[1]).toEqual(
      expect.objectContaining({ label: "Timeline fallback", matches: 2 }),
    );
  });

  it("extracts tweet snippet", () => {
    const dom = new JSDOM(fixture("tweet.html"));
    expect(extractTweetSnippet(dom.window.document)).toBe("Primary tweet text body.");
  });
});
