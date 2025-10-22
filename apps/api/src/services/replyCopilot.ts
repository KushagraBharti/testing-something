import { RepliesRequestSchema, RepliesResponseSchema } from '@pulse-kit/shared';
import type { RepliesRequest } from '@pulse-kit/shared';
import type { EnvBindings } from '../env.js';
import { generateRepliesWithOpenAI } from './providers/openai.js';
import type { ReplyCopilotResult } from './types.js';

const fallbackReplies = (request: RepliesRequest): [string, string, string] => {
  const base = request.tweet_text.slice(0, 80);
  return [
    `Insight: ${base}... curious what wildcards you are tracking?`,
    'Question: How would this play out if the team doubled their pace tomorrow?',
    'Example: We ran a similar playbook last quarter and saw replies jump 2x in 48 hours.',
  ];
};

export const generateReplies = async (
  env: EnvBindings,
  request: RepliesRequest,
): Promise<ReplyCopilotResult> => {
  const parsed = RepliesRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error('Invalid request body');
  }

  try {
    const response = await generateRepliesWithOpenAI(env, parsed.data);
    const validated = RepliesResponseSchema.parse(response);
    return { response: validated };
  } catch {
    return { response: { replies: fallbackReplies(parsed.data) } };
  }
};
