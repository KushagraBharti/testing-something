import { sign, verify } from 'hono/jwt';
import type { EnvBindings } from '../env.js';

export interface JwtPayload {
  sub: string;
  scope?: string[];
  exp?: number;
  iat?: number;
}

export const createJwt = async (
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  env: EnvBindings,
  ttlSeconds = 900,
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;

  return sign(
    {
      ...payload,
      iat: now,
      exp,
    },
    env.JWT_SECRET,
  );
};

export const verifyJwt = async (
  token: string,
  env: EnvBindings,
): Promise<JwtPayload | null> => {
  try {
    const decoded = await verify(token, env.JWT_SECRET);
    return decoded as JwtPayload;
  } catch (error) {
    return null;
  }
};
