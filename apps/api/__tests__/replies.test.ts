import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.js";
import { createJwt } from "../src/lib/jwt.js";
import { resolveEnv } from "../src/env.js";
import { resetRateLimiterState } from "../src/middleware/rateLimiter.js";

const env = resolveEnv({ JWT_SECRET: "test-secret" });

const mocks = vi.hoisted(() => ({
  mockGenerateReplies: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({
  ensureAnalyticsPreference: vi.fn().mockResolvedValue(false),
  recordTrendUsage: vi.fn(),
  setAnalyticsOptIn: vi.fn(),
  getTrendMetrics: vi.fn().mockReturnValue({ cost: 0, calls: 0 }),
}));

const loggerMocks = vi.hoisted(() => ({
  logFeatureEvent: vi.fn(),
  logPanelEvent: vi.fn(),
}));

vi.mock("../src/services/providers/openai.js", () => ({
  generateRepliesWithOpenAI: mocks.mockGenerateReplies,
  clusterSnippetsWithOpenAI: vi.fn(),
  generateIdeasWithOpenAI: vi.fn(),
}));

vi.mock("../src/lib/analyticsStore.js", () => ({
  ensureAnalyticsPreference: analyticsMocks.ensureAnalyticsPreference,
  recordTrendUsage: analyticsMocks.recordTrendUsage,
  setAnalyticsOptIn: analyticsMocks.setAnalyticsOptIn,
  getTrendMetrics: analyticsMocks.getTrendMetrics,
}));

vi.mock("../src/lib/analyticsLogger.js", () => ({
  logFeatureEvent: loggerMocks.logFeatureEvent,
  logPanelEvent: loggerMocks.logPanelEvent,
}));

const buildAuthHeader = async () => {
  const token = await createJwt({ sub: "user-1", scope: ["replies"] }, env);
  return `Bearer ${token}`;
};

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

describe("ReplyCopilot route", () => {
  let authHeader: string;

  beforeEach(async () => {
    authHeader = await buildAuthHeader();
    mocks.mockGenerateReplies.mockReset().mockResolvedValue({
      replies: ["Insight reply", "Question reply", "Example reply"],
    });
    analyticsMocks.ensureAnalyticsPreference.mockReset().mockResolvedValue(false);
    loggerMocks.logFeatureEvent.mockReset();
    resetRateLimiterState();
  });

  it("normalizes replies and trims to 180 chars", async () => {
    mocks.mockGenerateReplies.mockResolvedValueOnce({
      replies: [
        new Array(220).fill("a").join(""),
        "  Reply with   loose   spacing  ",
        "Third reply",
      ],
    });

    const response = await app.fetch(
      makeJsonRequest("http://localhost/ai/replies", {
        headers: { Authorization: authHeader },
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
      }),
      env,
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.replies).toHaveLength(3);
    json.replies.forEach((reply: string) => {
      expect(reply.length).toBeLessThanOrEqual(181);
    });
  });

  it("returns fallback replies after repeated failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.mockGenerateReplies.mockRejectedValueOnce(new Error("invalid"));
    mocks.mockGenerateReplies.mockRejectedValueOnce(new Error("invalid again"));

    const response = await app.fetch(
      makeJsonRequest("http://localhost/ai/replies", {
        headers: { Authorization: authHeader },
        body: {
          tweet_text: "Fallback tweet",
          context_summary: null,
          style_profile: {
            voice: "Direct",
            cadence: "Curious",
            sentence_length: "Short bursts",
            favorite_phrases: ["ship it"],
            banned_words: [],
          },
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.replies).toHaveLength(3);
    warnSpy.mockRestore();
  });

  it("logs analytics usage for replies when opted in", async () => {
    analyticsMocks.ensureAnalyticsPreference.mockResolvedValueOnce(true);

    const response = await app.fetch(
      makeJsonRequest("http://localhost/ai/replies", {
        headers: { Authorization: authHeader },
        body: {
          tweet_text: "Analytics reply",
          context_summary: null,
          style_profile: {
            voice: "Direct",
            cadence: "Curious",
            sentence_length: "Short bursts",
            favorite_phrases: ["ship it"],
            banned_words: [],
          },
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(loggerMocks.logFeatureEvent).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ user_id: "user-1", feature: "replies" }),
    );
  });
});
