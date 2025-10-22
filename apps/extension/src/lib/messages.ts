import type { StyleProfile } from "@pulse-kit/shared";

export type ExtensionMessage =
  | { type: "pulse:getToken" }
  | { type: "pulse:setToken"; token: string | null; expiresAt?: number | null }
  | { type: "pulse:apiRequest"; path: string; method?: "POST" | "GET"; body?: unknown }
  | { type: "pulse:setStyleProfile"; profile: StyleProfile };

export type ExtensionResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface StoredToken {
  token: string | null;
  expiresAt?: number | null;
}

export const STORAGE_KEYS = {
  token: "pulse-kit-extension-token",
  styleProfile: "pulse-kit-style-profile",
} as const;
