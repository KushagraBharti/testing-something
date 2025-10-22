
import { z } from "zod";

export const StyleProfileSchema = z.object({
  voice: z.string().min(1).max(480),
  cadence: z.string().min(1).max(240),
  sentence_length: z.string().min(1).max(160),
  favorite_phrases: z.array(z.string().min(1).max(120)).max(12),
  banned_words: z.array(z.string().min(1).max(64)).max(20),
});

export const ClusterTopicSchema = z.object({
  topic: z.string().min(1).max(140),
  pain_points: z.array(z.string().min(1).max(160)).length(3),
  quotes: z.array(z.string().min(1).max(240)).length(2),
});

export const ClusterResponseSchema = z.array(ClusterTopicSchema).min(1).max(5);

export const IdeasRequestSchema = z
  .object({
    snippets: z.array(z.string().min(1)).max(30),
    style_profile: StyleProfileSchema,
    want_trends: z.boolean().default(false),
    niche: z.string().min(1).max(120).nullable(),
    trend_sources_max: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(1),
    model: z.enum(["openai", "xai"]).optional(),
  })
  .superRefine((value, ctx) => {
    value.snippets.forEach((snippet, index) => {
      if (snippet.length > 240) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Snippet at index ${index} exceeds 240 characters`,
          path: ["snippets", index],
        });
      }
    });
  });

export const IdeaOutlineItemSchema = z.object({
  hook: z.string().min(1).max(120),
  mini_outline: z.array(z.string().min(1).max(140)).min(5).max(7),
  virality_score: z.number().int().min(0).max(100),
  recommended_time: z.enum(["morning", "afternoon", "evening"]),
});

export const IdeaTopicSchema = z.object({
  topic: z.string().min(1).max(140),
  trend_notes: z.array(z.string().min(1).max(200)).max(5),
  items: z.array(IdeaOutlineItemSchema).min(1).max(6),
});

export const IdeasResponseSchema = z.object({
  ideas: z.array(IdeaTopicSchema).min(1).max(6),
  sources_used: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url().optional(),
      }),
    )
    .optional(),
});

export const RepliesRequestSchema = z.object({
  tweet_text: z.string().min(1).max(1000),
  context_summary: z.string().min(1).max(500).nullable(),
  style_profile: StyleProfileSchema,
});

export const RepliesResponseSchema = z.object({
  replies: z
    .tuple([
      z.string().min(1).max(180),
      z.string().min(1).max(180),
      z.string().min(1).max(180),
    ])
    .transform((tuple) => tuple.map((reply) => reply.trim()) as [string, string, string]),
});

export const StyleProfileRequestSchema = z.object({
  user_posts: z.array(z.string().min(1).max(240)).min(3).max(50),
});

export type StyleProfileInput = z.infer<typeof StyleProfileSchema>;
export type IdeasRequestInput = z.infer<typeof IdeasRequestSchema>;
export type IdeasResponseOutput = z.infer<typeof IdeasResponseSchema>;
export type RepliesRequestInput = z.infer<typeof RepliesRequestSchema>;
export type RepliesResponseOutput = z.infer<typeof RepliesResponseSchema>;
export type ClusterResponseOutput = z.infer<typeof ClusterResponseSchema>;

