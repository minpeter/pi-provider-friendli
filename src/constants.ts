import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

export const FRIENDLIAI_BASE_URL = "https://api.friendli.ai/serverless/v1";

/**
 * Controllable reasoning models (K-EXAONE, GLM-5.1, GLM-5.2) toggle thinking
 * via `chat_template_kwargs.enable_thinking`. Effort levels all collapse to
 * "on" on the wire, so only off and max are exposed.
 */
export const TOGGLE_THINKING_LEVELS = {
  high: null,
  low: null,
  max: "max",
  medium: null,
  minimal: null,
  off: "none",
  xhigh: null,
} as const;

/**
 * Always-reasoning models (MiniMax-M2.5, DeepSeek-V3.2) cannot disable
 * thinking; the selector stays locked at max.
 */
export const ALWAYS_THINKING_LEVELS = {
  high: null,
  low: null,
  max: "max",
  medium: null,
  minimal: null,
  off: null,
  xhigh: null,
} as const;

/**
 * Live-verified against the serverless endpoint: the `developer` role is
 * rejected (HTTP 422), while `max_completion_tokens` and streaming usage are
 * accepted.
 */
export const FRIENDLIAI_COMPAT = {
  maxTokensField: "max_completion_tokens",
  supportsDeveloperRole: false,
  supportsUsageInStreaming: true,
} as const;

export const TOGGLE_COMPAT = {
  ...FRIENDLIAI_COMPAT,
  thinkingFormat: "qwen-chat-template",
} as const;

export const ALWAYS_COMPAT = {
  ...FRIENDLIAI_COMPAT,
  supportsReasoningEffort: false,
} as const;

/** Current FriendliAI serverless models, before authenticated refresh. */
export const FALLBACK_MODELS: ProviderModelConfig[] = [
  {
    compat: FRIENDLIAI_COMPAT,
    contextWindow: 262_144,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0.2, output: 0.8 },
    id: "Qwen/Qwen3-235B-A22B-Instruct-2507",
    input: ["text"],
    maxTokens: 262_144,
    name: "Qwen3 235B A22B Instruct 2507",
    reasoning: false,
  },
  {
    compat: TOGGLE_COMPAT,
    contextWindow: 262_144,
    cost: { cacheRead: 0.1, cacheWrite: 0, input: 0.2, output: 0.8 },
    id: "LGAI-EXAONE/K-EXAONE-236B-A23B",
    input: ["text"],
    maxTokens: 262_144,
    name: "K-EXAONE 236B A23B",
    reasoning: true,
    thinkingLevelMap: TOGGLE_THINKING_LEVELS,
  },
  {
    compat: ALWAYS_COMPAT,
    contextWindow: 196_608,
    cost: { cacheRead: 0.06, cacheWrite: 0, input: 0.3, output: 1.2 },
    id: "MiniMaxAI/MiniMax-M2.5",
    input: ["text"],
    maxTokens: 196_608,
    name: "MiniMax M2.5",
    reasoning: true,
    thinkingLevelMap: ALWAYS_THINKING_LEVELS,
  },
  {
    compat: ALWAYS_COMPAT,
    contextWindow: 163_840,
    cost: { cacheRead: 0.25, cacheWrite: 0, input: 0.5, output: 1.5 },
    id: "deepseek-ai/DeepSeek-V3.2",
    input: ["text"],
    maxTokens: 163_840,
    name: "DeepSeek V3.2",
    reasoning: true,
    thinkingLevelMap: ALWAYS_THINKING_LEVELS,
  },
  {
    compat: TOGGLE_COMPAT,
    contextWindow: 202_752,
    cost: { cacheRead: 0.26, cacheWrite: 0, input: 1.4, output: 4.4 },
    id: "zai-org/GLM-5.1",
    input: ["text"],
    maxTokens: 202_752,
    name: "GLM 5.1",
    reasoning: true,
    thinkingLevelMap: TOGGLE_THINKING_LEVELS,
  },
  {
    compat: FRIENDLIAI_COMPAT,
    contextWindow: 262_144,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0.14, output: 0.4 },
    id: "google/gemma-4-31B-it",
    input: ["text", "image"],
    maxTokens: 262_144,
    name: "Gemma 4 31B It",
    reasoning: false,
  },
  {
    compat: TOGGLE_COMPAT,
    contextWindow: 1_048_576,
    cost: { cacheRead: 0.26, cacheWrite: 0, input: 1.4, output: 4.4 },
    id: "zai-org/GLM-5.2",
    input: ["text"],
    maxTokens: 1_048_576,
    name: "GLM 5.2",
    reasoning: true,
    thinkingLevelMap: TOGGLE_THINKING_LEVELS,
  },
];
