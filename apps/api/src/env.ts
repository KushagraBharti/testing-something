import { env as nodeEnv } from "node:process";

export interface EnvBindings {
  OPENAI_API_KEY?: string;
  XAI_API_KEY?: string;
  X_API_BEARER?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  JWT_SECRET: string;
  API_BASE_URL?: string;
  WEB_ORIGIN?: string;
  EXTENSION_ORIGIN?: string;
  BYO_ENCRYPTION_KEY?: string;
  SESSION_TOKEN_SECRET?: string;
}

export const readNodeEnv = (): EnvBindings => ({
  OPENAI_API_KEY: nodeEnv.OPENAI_API_KEY,
  XAI_API_KEY: nodeEnv.XAI_API_KEY,
  X_API_BEARER: nodeEnv.X_API_BEARER,
  SUPABASE_URL: nodeEnv.SUPABASE_URL,
  SUPABASE_ANON_KEY: nodeEnv.SUPABASE_ANON_KEY,
  JWT_SECRET: nodeEnv.JWT_SECRET ?? "change_me",
  API_BASE_URL: nodeEnv.API_BASE_URL ?? "http://localhost:8787",
  WEB_ORIGIN: nodeEnv.WEB_ORIGIN ?? "http://localhost:5173",
  EXTENSION_ORIGIN: nodeEnv.EXTENSION_ORIGIN ?? "chrome-extension://mock-id",
  BYO_ENCRYPTION_KEY: nodeEnv.BYO_ENCRYPTION_KEY,
  SESSION_TOKEN_SECRET: nodeEnv.SESSION_TOKEN_SECRET,
});

export const resolveEnv = (bindings?: Partial<EnvBindings>): EnvBindings => {
  const base = readNodeEnv();
  if (!bindings) {
    return base;
  }

  return {
    ...base,
    ...bindings,
    JWT_SECRET: bindings.JWT_SECRET ?? base.JWT_SECRET,
  };
};
