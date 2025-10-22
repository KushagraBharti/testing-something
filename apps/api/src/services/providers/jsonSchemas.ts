
export const clustersJsonSchema = {
  type: "array",
  minItems: 1,
  maxItems: 5,
  items: {
    type: "object",
    required: ["topic", "pain_points", "quotes"],
    additionalProperties: false,
    properties: {
      topic: { type: "string", minLength: 1, maxLength: 140 },
      pain_points: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string", minLength: 1, maxLength: 160 },
      },
      quotes: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
  },
} as const;

export const ideasJsonSchema = {
  type: "object",
  required: ["ideas"],
  additionalProperties: false,
  properties: {
    ideas: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        required: ["topic", "trend_notes", "items"],
        additionalProperties: false,
        properties: {
          topic: { type: "string", minLength: 1, maxLength: 140 },
          trend_notes: {
            type: "array",
            minItems: 0,
            maxItems: 5,
            items: { type: "string", minLength: 1, maxLength: 200 },
          },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              required: ["hook", "mini_outline", "virality_score", "recommended_time"],
              additionalProperties: false,
              properties: {
                hook: { type: "string", minLength: 1, maxLength: 120 },
                mini_outline: {
                  type: "array",
                  minItems: 5,
                  maxItems: 7,
                  items: { type: "string", minLength: 1, maxLength: 140 },
                },
                virality_score: { type: "integer", minimum: 0, maximum: 100 },
                recommended_time: {
                  type: "string",
                  enum: ["morning", "afternoon", "evening"],
                },
              },
            },
          },
        },
      },
    },
    sources_used: {
      type: "array",
      minItems: 0,
      items: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          url: { type: "string", format: "uri" },
        },
      },
    },
  },
} as const;

export const repliesJsonSchema = {
  type: "object",
  required: ["replies"],
  additionalProperties: false,
  properties: {
    replies: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 1, maxLength: 180 },
    },
  },
} as const;

export const trendsJsonSchema = {
  type: "object",
  required: ["trend_notes", "sources_used"],
  additionalProperties: false,
  properties: {
    trend_notes: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: { type: "string", minLength: 1, maxLength: 200 },
    },
    sources_used: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          url: { type: "string", format: "uri" },
        },
      },
    },
  },
} as const;

