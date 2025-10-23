import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.js";
import { createJwt } from "../src/lib/jwt.js";
import { resolveEnv } from "../src/env.js";
import { setRateLimiterOptions, resetRateLimiterState } from "../src/middleware/rateLimiter.js";

const env = resolveEnv({ JWT_SECRET: "test-secret", SESSION_TOKEN_SECRET: "session-secret" });

const mocks = vi.hoisted(() => ({
  mockCluster: vi.fn(),
  mockGenerateIdeas: vi.fn(),
  mockGenerateReplies: vi.fn(),
  mockFetchTrends: vi.fn(),
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

const userStoreMocks = vi.hoisted(() => ({
  recordUserLogin: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("../src/services/providers/openai.js", () => ({
  clusterSnippetsWithOpenAI: mocks.mockCluster,
  generateIdeasWithOpenAI: mocks.mockGenerateIdeas,
  generateRepliesWithOpenAI: mocks.mockGenerateReplies,
}));

vi.mock("../src/services/providers/xai.js", () => ({
  fetchTrendSparks: mocks.mockFetchTrends,
}));

vi.mock("../src/services/userStore.js", () => userStoreMocks);

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
  const token = await createJwt({ sub: "user-1", scope: ["ideas", "replies"] }, env);
  return `Bearer ${token}`;
};

const makeJsonRequest = (
  url: string,
  options: { method?: string; headers?: HeadersInit; body?: unknown },
) => {
  const init: RequestInit = {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  return new Request(url, init);
};

describe("IdeaEngine route", () => {
  let authHeader: string;

  beforeEach(async () => {
    authHeader = await buildAuthHeader();

    mocks.mockCluster.mockReset().mockResolvedValue([
      { topic: "ai agents", pain_points: ["tooling gap"], quotes: ["agents snippet"] },
    ]);

    mocks.mockGenerateIdeas.mockReset().mockResolvedValue({
      ideas: [
        {
          topic: "ai agents",
          trend_notes: ["Fresh spark"],
          items: [
            {
              hook: "Agent skills to ship now",
              mini_outline: ["Point", "Proof", "Question", "CTA", "Bonus"],
              virality_score: 72,
              recommended_time: "morning",
            },
          ],
        },
      ],
    });

    mocks.mockFetchTrends.mockReset().mockResolvedValue({
      trend_notes: ["Live X signal"],
      sources_used: [{ name: "X", url: "https://x.com" }],
      estimated_cost_usd: 0.025,
    });

    userStoreMocks.recordUserLogin.mockReset().mockResolvedValue(undefined);
    userStoreMocks.updateSettings.mockReset().mockResolvedValue(undefined);
    analyticsMocks.recordTrendUsage.mockReset();
    analyticsMocks.ensureAnalyticsPreference.mockReset().mockResolvedValue(false);
    loggerMocks.logFeatureEvent.mockReset();
    resetRateLimiterState();
  });

  afterEach(() => {
    resetRateLimiterState();
  });

  it("rejects missing auth header", async () => {
    const request = makeJsonRequest("http://localhost/ai/ideas", { body: {} });
    const response = await app.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("clamps hook words, outline length, and virality", async () => {
    mocks.mockGenerateIdeas.mockResolvedValueOnce({
      ideas: [
        {
          topic: "Latency stories",
          trend_notes: ["News: Major release"],
          items: [
            {
              hook: new Array(25).fill("word").join(" "),
              mini_outline: new Array(9).fill(
                "This bullet is intentionally very long with emoji ✨\u200D to test limits" +
                  " and an extra tail to exceed the allowed character limit by quite a bit.",
              ),
              virality_score: 142.4,
              recommended_time: "evening",
            },
          ],
        },
      ],
      sources_used: [],
    });

    const request = makeJsonRequest("http://localhost/ai/ideas", {
      headers: { Authorization: authHeader },
      body: {
        snippets: ["Long form snippet to exercise clamping."],
        style_profile: {
          voice: "Energetic",
          cadence: "Quick hits",
          sentence_length: "Short bursts",
          favorite_phrases: ["ship it"],
          banned_words: [],
        },
        want_trends: false,
        niche: null,
        trend_sources_max: 1,
      },
    });

    const response = await app.fetch(request, env);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ideas).toHaveLength(5);
    const item = json.ideas[0].items[0];
    expect(item.virality_score).toBeLessThanOrEqual(100);
    expect(item.hook.split(/\s+/).length).toBeLessThanOrEqual(18);
    expect(item.mini_outline).toHaveLength(5);
    item.mini_outline.forEach((line: string) => {
      expect(line.length).toBeLessThanOrEqual(140);
    });
  });

  it("retries and falls back with lite ideas when LLM output is invalid", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.mockGenerateIdeas
      .mockRejectedValueOnce(new Error("invalid json"))
      .mockRejectedValueOnce(new Error("still invalid"));

    const request = makeJsonRequest("http://localhost/ai/ideas", {
      headers: { Authorization: authHeader },
      body: {
        snippets: ["Fallback snippet"],
        style_profile: {
          voice: "Analytical",
          cadence: "Fast",
          sentence_length: "Short",
          favorite_phrases: ["builders"],
          banned_words: [],
        },
        want_trends: false,
        niche: null,
        trend_sources_max: 1,
      },
    });

    const response = await app.fetch(request, env);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ideas.length).toBeGreaterThanOrEqual(3);
    warnSpy.mockRestore();
  });

  it("enforces trend source caps and logs cost", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const request = makeJsonRequest("http://localhost/ai/ideas", {
      headers: { Authorization: authHeader },
      body: {
        snippets: ["Trend snippet"],
        style_profile: {
          voice: "Analytical",
          cadence: "Fast",
          sentence_length: "Short",
          favorite_phrases: ["builders"],
          banned_words: [],
        },
        want_trends: true,
        niche: null,
        trend_sources_max: 2,
      },
    });

    const response = await app.fetch(request, env);
    expect(response.status).toBe(200);
    expect(mocks.mockFetchTrends).toHaveBeenCalledTimes(1);
    const args = mocks.mockFetchTrends.mock.calls[0];
    expect(args[2]).toBe(2);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[xai-trends]"),
      expect.objectContaining({ estimated_cost_usd: expect.any(Number) }),
    );
    logSpy.mockRestore();
  });

  it("supports refreshing token after unauthorized response", async () => {
    const invalidRequest = makeJsonRequest("http://localhost/ai/ideas", {
      headers: { Authorization: "Bearer invalid" },
      body: {
        snippets: ["Refresh flow snippet"],
        style_profile: {
          voice: "Analytical",
          cadence: "Fast",
          sentence_length: "Short",
          favorite_phrases: ["builders"],
          banned_words: [],
        },
        want_trends: false,
        niche: null,
        trend_sources_max: 1,
      },
    });

    const invalidResponse = await app.fetch(invalidRequest, env);
    expect(invalidResponse.status).toBe(401);

    const refreshRequest = makeJsonRequest("http://localhost/auth/refresh", {
      headers: { "Content-Type": "application/json" },
      body: {
        user_id: "user-1",
        handle: "user",
        session_token: "session-secret",
      },
    });

    const refreshResponse = await app.fetch(refreshRequest, env);
    expect(refreshResponse.status).toBe(200);
    const refreshJson = await refreshResponse.json();
    expect(refreshJson.token).toBeDefined();
    expect(refreshJson.refresh_token).toBeDefined();

    const validRequest = makeJsonRequest("http://localhost/ai/ideas", {
      headers: { Authorization: `Bearer ${refreshJson.token}` },
      body: {
        snippets: ["Auth success snippet"],
        style_profile: {
          voice: "Analytical",
          cadence: "Fast",
          sentence_length: "Short",
          favorite_phrases: ["builders"],
          banned_words: [],
        },
        want_trends: false,
        niche: null,
        trend_sources_max: 1,
      },
    });

    const validResponse = await app.fetch(validRequest, env);
    expect(validResponse.status).toBe(200);
  });

  it("logs analytics usage when opted in", async () => {
    analyticsMocks.ensureAnalyticsPreference.mockResolvedValueOnce(true);

    const response = await app.fetch(
      makeJsonRequest("http://localhost/ai/ideas", {
        headers: { Authorization: authHeader },
        body: {
          snippets: ["Analytics snippet"],
          style_profile: {
            voice: "Analytical",
            cadence: "Fast",
            sentence_length: "Short",
            favorite_phrases: ["builders"],
            banned_words: [],
          },
          want_trends: true,
          niche: null,
          trend_sources_max: 1,
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(loggerMocks.logFeatureEvent).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ user_id: "user-1", feature: "ideas", trends_used: true }),
    );
    expect(analyticsMocks.recordTrendUsage).toHaveBeenCalled();
  });

  it("enforces per-user rate limits", async () => {
    setRateLimiterOptions({ limit: 2, windowMs: 60_000 });

    const makeRequest = () =>
      app.fetch(
        makeJsonRequest("http://localhost/ai/ideas", {
          headers: { Authorization: authHeader },
          body: {
            snippets: ["Rate limit"],
            style_profile: {
              voice: "Analytical",
              cadence: "Fast",
              sentence_length: "Short",
              favorite_phrases: ["builders"],
              banned_words: [],
            },
            want_trends: false,
            niche: null,
            trend_sources_max: 1,
          },
        }),
        env,
      );

    expect((await makeRequest()).status).toBe(200);
    expect((await makeRequest()).status).toBe(200);
    const limited = await makeRequest();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
  });
});
