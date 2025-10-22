import type {
  ClusterResponseOutput,
  IdeasRequest,
  IdeasResponse,
  RepliesRequest,
  RepliesResponse,
  StyleProfile,
} from '@pulse-kit/shared';

export type ProviderChoice = 'openai' | 'xai';

export interface IdeasContext {
  request: IdeasRequest;
  clusters: ClusterResponseOutput;
  trend_notes: string[];
  sources_used: Array<{ name: string; url?: string }>;
}

export interface IdeaEngineResult {
  response: IdeasResponse;
  sources_used: Array<{ name: string; url?: string }>;
}

export interface ReplyCopilotResult {
  response: RepliesResponse;
}

export interface StyleProfileResult {
  style_profile: StyleProfile;
}

export { IdeasRequest, IdeasResponse, RepliesRequest, RepliesResponse };

