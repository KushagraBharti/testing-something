
export type TrendSource = "x" | "news" | "web";

export interface StyleProfile {
  voice: string;
  cadence: string;
  sentence_length: string;
  favorite_phrases: string[];
  banned_words: string[];
}

export interface ClusterTopic {
  topic: string;
  pain_points: string[];
  quotes: string[];
}

export interface IdeasRequest {
  snippets: string[];
  style_profile: StyleProfile;
  want_trends: boolean;
  niche: string | null;
  trend_sources_max: 0 | 1 | 2;
  model?: "openai" | "xai";
}

export interface IdeaOutlineItem {
  hook: string;
  mini_outline: string[];
  virality_score: number;
  recommended_time: "morning" | "afternoon" | "evening";
}

export interface IdeaTopic {
  topic: string;
  trend_notes: string[];
  items: IdeaOutlineItem[];
}

export interface IdeasResponse {
  ideas: IdeaTopic[];
  sources_used?: Array<{
    name: string;
    url?: string;
  }>;
}

export interface RepliesRequest {
  tweet_text: string;
  context_summary: string | null;
  style_profile: StyleProfile;
}

export interface RepliesResponse {
  replies: [string, string, string];
}

export interface StyleProfileRequest {
  user_posts: string[];
}

export interface StyleProfileResponse {
  style_profile: StyleProfile;
}

export interface SelectorConfig {
  name: string;
  maxItems: number;
  itemSelector: string;
  contentSelector: string;
  fallbackSelectors?: string[];
}

