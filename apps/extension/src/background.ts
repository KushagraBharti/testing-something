import { STORAGE_KEYS, type ExtensionMessage, type ExtensionResponse, type StoredToken } from "./lib/messages";
import { defaultStyleProfile } from "./lib/defaultProfile";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

const RATE_LIMITS = {
  ideas: { capacity: 1, refillInterval: 8_000 },
  replies: { capacity: 3, refillInterval: 10_000 },
} as const;

type BucketKey = keyof typeof RATE_LIMITS;

type BucketState = Record<BucketKey, { tokens: number; lastRefill: number; lastUsed: number }>;

const createBucketState = (): BucketState => ({
  ideas: { tokens: RATE_LIMITS.ideas.capacity, lastRefill: Date.now(), lastUsed: Date.now() },
  replies: { tokens: RATE_LIMITS.replies.capacity, lastRefill: Date.now(), lastUsed: Date.now() },
});

let bucketState = createBucketState();
let tokenCache: StoredToken = { token: null, refreshToken: null, expiresAt: null };
let analyticsEnabled = false;

const getBucketKey = (path: string): BucketKey | null => {
  if (path.startsWith("ai/ideas")) return "ideas";
  if (path.startsWith("ai/replies")) return "replies";
  return null;
};

const refillBucket = (key: BucketKey) => {
  const bucket = bucketState[key];
  const now = Date.now();
  const limit = RATE_LIMITS[key];

  if (now - bucket.lastUsed > limit.refillInterval * 2) {
    bucket.tokens = limit.capacity;
    bucket.lastRefill = now;
    bucket.lastUsed = now;
    return;
  }

  if (now - bucket.lastRefill >= limit.refillInterval) {
    bucket.tokens = limit.capacity;
    bucket.lastRefill = now;
  }
};

const consumeBucket = (key: BucketKey): boolean => {
  const bucket = bucketState[key];
  refillBucket(key);

  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens -= 1;
  bucket.lastUsed = Date.now();
  return true;
};

const getStoredToken = async (): Promise<StoredToken> => {
  if (tokenCache.token && (!tokenCache.expiresAt || tokenCache.expiresAt > Date.now())) {
    return tokenCache;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.token, STORAGE_KEYS.analytics], (value) => {
      const stored = (value[STORAGE_KEYS.token] as StoredToken | undefined) ?? {
        token: null,
        refreshToken: null,
        expiresAt: null,
      };
      tokenCache = stored;
      analyticsEnabled = Boolean(value[STORAGE_KEYS.analytics]);
      resolve(stored);
    });
  });
};

const persistToken = async (payload: StoredToken) => {
  tokenCache = payload;
  await chrome.storage.local.set({ [STORAGE_KEYS.token]: payload });
  bucketState = createBucketState();
};

const refreshJwt = async (): Promise<boolean> => {
  const stored = await getStoredToken();
  if (!stored.refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: stored.token ? `Bearer ${stored.token}` : "",
      },
      body: JSON.stringify({ refresh_token: stored.refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const json = (await response.json()) as { token: string; refresh_token: string; expires_in: number };
    await persistToken({
      token: json.token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    });
    return true;
  } catch (error) {
    console.warn("[background] refresh failed", error);
    return false;
  }
};

const handleApiRequest = async (
  message: Extract<ExtensionMessage, { type: "pulse:apiRequest" }>,
): Promise<ExtensionResponse> => {
  const bucketKey = getBucketKey(message.path);
  if (bucketKey && !consumeBucket(bucketKey)) {
    return { ok: false, error: "Throttled" };
  }

  const stored = await getStoredToken();
  if (!stored.token) {
    return { ok: false, error: "Missing extension token" };
  }

  const doRequest = async () =>
    fetch(`${API_BASE_URL}/${message.path}`, {
      method: message.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${stored.token}`,
      },
      body: message.method === "GET" ? undefined : JSON.stringify(message.body ?? {}),
    });

  try {
    let response = await doRequest();
    if (response.status === 401 && (await refreshJwt())) {
      const fresh = await getStoredToken();
      response = await fetch(`${API_BASE_URL}/${message.path}`, {
        method: message.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: fresh.token ? `Bearer ${fresh.token}` : "",
        },
        body: message.method === "GET" ? undefined : JSON.stringify(message.body ?? {}),
      });
    }

    if (!response.ok) {
      if (response.status === 429) {
        return { ok: false, error: "rate_limited" };
      }

      try {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const json = await response.json();
          if (json?.error === "rate_limited") {
            return { ok: false, error: "rate_limited" };
          }
          return { ok: false, error: json?.error ?? `Request failed (${response.status})` };
        }
      } catch (error) {
        // swallow parsing error and fallback to text
      }

    const body = await response.text();
      return { ok: false, error: body || `Request failed (${response.status})` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error" };
  }
};

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "pulse:getToken": {
        bucketState = createBucketState();
        let stored = await getStoredToken();
        if (
          stored.refreshToken &&
          (!stored.token || (stored.expiresAt && stored.expiresAt < Date.now() + 60_000))
        ) {
          await refreshJwt();
          stored = await getStoredToken();
        }
        const response: ExtensionResponse<StoredToken> = { ok: true, data: stored };
        sendResponse(response);
        break;
      }
      case "pulse:setToken": {
        await persistToken({
          token: message.token,
          refreshToken: message.refreshToken ?? null,
          expiresAt: message.expiresAt ?? null,
        });
        const response: ExtensionResponse<null> = { ok: true, data: null };
        sendResponse(response);
        break;
      }
      case "pulse:apiRequest": {
        const response = await handleApiRequest(message);
        sendResponse(response);
        break;
      }
      case "pulse:setStyleProfile": {
        await chrome.storage.local.set({ [STORAGE_KEYS.styleProfile]: message.profile });
        const response: ExtensionResponse<null> = { ok: true, data: null };
        sendResponse(response);
        break;
      }
      case "pulse:setAnalytics": {
        analyticsEnabled = message.enabled;
        await chrome.storage.local.set({ [STORAGE_KEYS.analytics]: analyticsEnabled });
        const response: ExtensionResponse<null> = { ok: true, data: null };
        sendResponse(response);
        break;
      }
      case "pulse:analyticsEvent": {
        if (!analyticsEnabled) {
          const response: ExtensionResponse<null> = { ok: true, data: null };
          sendResponse(response);
          break;
        }

        const stored = await getStoredToken();
        if (!stored.token) {
          const response: ExtensionResponse<null> = { ok: false, error: "Missing extension token" };
          sendResponse(response);
          break;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/analytics/events`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${stored.token}`,
            },
            body: JSON.stringify({ event: message.event }),
          });

          if (!response.ok) {
            sendResponse({ ok: false, error: `Analytics request failed (${response.status})` });
            break;
          }

          sendResponse({ ok: true, data: null });
        } catch (error) {
          sendResponse({ ok: false, error: error instanceof Error ? error.message : "Network error" });
        }

        break;
      }
      case "pulse:resetLimiter": {
        bucketState = createBucketState();
        const response: ExtensionResponse<null> = { ok: true, data: null };
        sendResponse(response);
        break;
      }
      default: {
        sendResponse({ ok: false, error: "Unsupported message" });
      }
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    [STORAGE_KEYS.token, STORAGE_KEYS.styleProfile, STORAGE_KEYS.analytics],
    (value) => {
      if (!value[STORAGE_KEYS.token]) {
        chrome.storage.local.set({
          [STORAGE_KEYS.token]: { token: null, refreshToken: null, expiresAt: null },
        });
      }
      if (!value[STORAGE_KEYS.styleProfile]) {
        chrome.storage.local.set({ [STORAGE_KEYS.styleProfile]: defaultStyleProfile });
      }
      if (typeof value[STORAGE_KEYS.analytics] === "undefined") {
        chrome.storage.local.set({ [STORAGE_KEYS.analytics]: false });
        analyticsEnabled = false;
      } else {
        analyticsEnabled = Boolean(value[STORAGE_KEYS.analytics]);
      }
    },
  );
});
