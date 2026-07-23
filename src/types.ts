/** Raw shape of one entry from FriendliAI's GET /models (fields unverified). */
export interface FriendliApiPricing {
  prompt?: unknown;
  completion?: unknown;
  input?: unknown;
  output?: unknown;
  input_cache_read?: unknown;
  input_cache_write?: unknown;
}

export interface FriendliApiModel {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  max_completion_tokens?: unknown;
  pricing?: FriendliApiPricing;
}

export interface FriendliModelsResponse {
  data?: unknown;
}
