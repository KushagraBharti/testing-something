import { describe, expect, it, vi } from "vitest";
import app from "../src/index.js";
import { createJwt } from "../src/lib/jwt.js";
import { resolveEnv } from "../src/env.js";

const env = resolveEnv({ JWT_SECRET: "test-secret" });

vi.mock("../src/services/providers/openai.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/services/providers/openai.js")>();
  return {
    ...original,
    generateRepliesWithOpenAI: vi.fn().mockResolvedValue({
      replies: ["Insight reply", "Question reply", "Example reply"],
    }),
  };
});

const makeJsonRequest = (url: string, options: { headers?: HeadersInit; body?: unknown }) => {
  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  return new Request(url, init);
};

const buildAuthHeader = async () => {
  const token = await createJwt({ sub: "user-1", scope: ["replies"] }, env);
  return `Bearer ${token}`;
};

describe("ReplyCopilot route", () => {
  it("produces three replies", async () => {
    const request = makeJsonRequest("http://localhost/ai/replies", {
      headers: { Authorization: await buildAuthHeader() },
      body: {
        tweet_text: "AI infra is getting rewired in real-time.",
        context_summary: null,
        style_profile: {
          voice: "Direct",
          cadence: "Curious",
          sentence_length: "Short bursts",
          favorite_phrases: ["ship it"],
          banned_words: [],
        },
      },
    });

    const response = await app.fetch(request, env);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.replies.length).toBe(3);
  });
});
