import type { EnvBindings } from './env.js';
import type { JwtPayload } from './lib/jwt.js';

export interface AppBindings extends EnvBindings {}

export interface AppVariables {
  user?: JwtPayload;
}

