import {
  RepliesRequestSchema,
  RepliesResponseSchema,
  clampVisibleLength,
  normalizeWhitespace,
} from '@pulse-kit/shared';
import type { RepliesRequest } from '@pulse-kit/shared';
import type { EnvBindings } from '../env.js';
import { generateRepliesWithOpenAI } from './providers/openai.js';
import type { ReplyCopilotResult } from './types.js';

const sanitizeReply = (reply: string): string =>
  clampVisibleLength(normalizeWhitespace(reply), 180).text;

const normalizeReplies = (payload: { replies: string[] }): [string, string, string] => {
  const sanitized = payload.replies.map(sanitizeReply).filter(Boolean);

  const fillers = [
    'Insight: Zoom out and highlight the strategic shift hiding in this thread.',
    'Question: What would change if you doubled the pace on this experiment tomorrow?',
    'Example: We ran a similar playbook last quarter and doubled replies inside 48 hours.',
  ];

  while (sanitized.length < 3 && fillers.length) {
    sanitized.push(fillers[sanitized.length]);
  }

  const parsed = RepliesResponseSchema.safeParse({
    replies: sanitized.slice(0, 3),
  });

  if (!parsed.success) {
    throw new Error('Replies payload failed post-normalization validation');
  }

  return parsed.data.replies;
};

const fallbackReplies = (request: RepliesRequest): [string, string, string] => {
  const base = sanitizeReply(request.tweet_text).slice(0, 120);
  return normalizeReplies({
    replies: [
      `Insight: ${base ? `${base} ` : ''}Zoom out and call the hidden lever.`,
      'Question: Where does this unlock compounding replies for your audience?',
      'Example: We applied this play last season and doubled engagement in 48 hours.',
    ],
  });
};

export const generateReplies = async (
  env: EnvBindings,
  request: RepliesRequest,
  _options: { userId: string },
): Promise<ReplyCopilotResult> => {
  const parsed = RepliesRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error('Invalid request body');
  }

  const attempts = [
    { temperature: 0.2, reminder: undefined },
    { temperature: 0.1, reminder: 'STRICT JSON ONLY, NO PROSE.' },
  ];

  for (const attempt of attempts) {
    try {
      const response = await generateRepliesWithOpenAI(
        env,
        parsed.data,
        { temperature: attempt.temperature, systemReminder: attempt.reminder },
      );
      return {
        response: { replies: normalizeReplies(response) },
        metrics: { generatedAt: Date.now() },
      };
    } catch (error) {
      console.warn('[replycopilot] generation attempt failed', { attempt: attempt.reminder ?? 'primary', error });
    }
  }

  return {
    response: { replies: fallbackReplies(parsed.data) },
    metrics: { generatedAt: Date.now() },
  };
};
