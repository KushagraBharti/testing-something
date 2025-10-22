import { STORAGE_KEYS, type ExtensionMessage, type ExtensionResponse, type StoredToken } from "./lib/messages";
import { defaultStyleProfile } from "./lib/defaultProfile";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

let tokenCache: StoredToken = { token: null, expiresAt: null };

const rateLimiter = {
  capacity: 4,
  tokens: 4,
  refillInterval: 15_000,
  lastRefill: Date.now(),
};

const refillTokens = () => {
  const now = Date.now();
  const elapsed = now - rateLimiter.lastRefill;
  if (elapsed > rateLimiter.refillInterval) {
    rateLimiter.tokens = rateLimiter.capacity;
    rateLimiter.lastRefill = now;
  }
};

const consumeToken = () => {
  refillTokens();
  if (rateLimiter.tokens <= 0) {
    return false;
  }
  rateLimiter.tokens -= 1;
  return true;
};

const getStoredToken = async (): Promise<StoredToken> => {
  if (tokenCache.token && (!tokenCache.expiresAt || tokenCache.expiresAt > Date.now())) {
    return tokenCache;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.token], (value) => {
      const stored = value[STORAGE_KEYS.token] as StoredToken | undefined;
      tokenCache = stored ?? { token: null, expiresAt: null };
      resolve(tokenCache);
    });
  });
};

const persistToken = async (payload: StoredToken) => {
  tokenCache = payload;
  await chrome.storage.local.set({ [STORAGE_KEYS.token]: payload });
};

const handleApiRequest = async (
  message: Extract<ExtensionMessage, { type: "pulse:apiRequest" }>,
): Promise<ExtensionResponse> => {
  if (!consumeToken()) {
    return { ok: false, error: "Rate limit exceeded" };
  }

  const { token } = await getStoredToken();
  if (!token) {
    return { ok: false, error: "Missing extension token" };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/${message.path}`, {
      method: message.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: message.method === "GET" ? undefined : JSON.stringify(message.body ?? {}),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: body || `Request failed (${response.status})` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "pulse:getToken": {
        const stored = await getStoredToken();
        const response: ExtensionResponse<StoredToken> = { ok: true, data: stored };
        sendResponse(response);
        break;
      }
      case "pulse:setToken": {
        await persistToken({ token: message.token, expiresAt: message.expiresAt });
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
      default: {
        sendResponse({ ok: false, error: "Unsupported message" });
      }
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEYS.token, STORAGE_KEYS.styleProfile], (value) => {
    if (!value[STORAGE_KEYS.token]) {
      const initial: StoredToken = { token: null, expiresAt: null };
      chrome.storage.local.set({ [STORAGE_KEYS.token]: initial });
    }
    if (!value[STORAGE_KEYS.styleProfile]) {
      chrome.storage.local.set({ [STORAGE_KEYS.styleProfile]: defaultStyleProfile });
    }
  });
});
