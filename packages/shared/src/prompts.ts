export const PROMPT_VERSION = '2024-10-ideaengine';

export const CLUSTER_SYSTEM_PROMPT = `You group short social snippets into 3–5 topics. Output strict JSON: [{ "topic": string, "pain_points": string[3], "quotes": string[2] }]. No prose.`;

export const IDEAS_USER_PROMPT = `Using topics + style_profile + optional trend_notes, return 5–6 ideas as strict JSON:
{
  "ideas": [
    {
      "topic": string,
      "trend_notes": string[],
      "items": [
        {
          "hook": string (<=18 words),
          "mini_outline": string[5..7],
          "virality_score": 0..100,
          "recommended_time": "morning"|"afternoon"|"evening"
        }
      ]
    }
  ]
}
Constraints: hooks punchy, no hashtags, outlines <140 chars per bullet, obey banned_words.`;

export const REPLIES_USER_PROMPT = `Given tweet_text, optional context_summary, and style_profile, produce strict JSON:
{ "replies": [ string, string, string ] }
Each <180 chars; angles: insight, question, example; no hashtags.`;

export const STYLE_PROFILE_SYSTEM_PROMPT = `Summarize voice as JSON under 120 words total: { "voice": string, "cadence": string, "sentence_length": string, "favorite_phrases": string[], "banned_words": string[] }.`;
