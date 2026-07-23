import type {
  ProviderConfig,
  ProviderModelConfig,
} from "@earendil-works/pi-coding-agent";

import {
  FALLBACK_MODELS,
  FRIENDLIAI_BASE_URL,
  FRIENDLIAI_COMPAT,
} from "./constants.ts";
import type { FriendliModelsResponse } from "./types.ts";
import { displayName, perMillionCost, positiveInteger } from "./utils.ts";

type ModelCost = ProviderModelConfig["cost"];

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const parseCost = (
  pricing: Record<string, unknown>,
  fallback: ModelCost | undefined
): ModelCost => ({
  cacheRead: perMillionCost(pricing.input_cache_read, fallback?.cacheRead ?? 0),
  cacheWrite: perMillionCost(
    pricing.input_cache_write,
    fallback?.cacheWrite ?? 0
  ),
  input: perMillionCost(pricing.prompt ?? pricing.input, fallback?.input ?? 0),
  output: perMillionCost(
    pricing.completion ?? pricing.output,
    fallback?.output ?? 0
  ),
});

const resolveName = (
  item: Record<string, unknown>,
  fallback: ProviderModelConfig | undefined
): string => {
  if (fallback) {
    return fallback.name;
  }
  const { name } = item;
  if (typeof name === "string" && name.length > 0 && name !== item.id) {
    return name;
  }
  return displayName(String(item.id));
};

const parseEntry = (
  raw: unknown,
  known: ReadonlyMap<string, ProviderModelConfig>
): ProviderModelConfig[] => {
  const item = toRecord(raw);
  if (typeof item.id !== "string" || item.id.length === 0) {
    return [];
  }
  const fallback = known.get(item.id);
  const input: ProviderModelConfig["input"] = fallback?.input ?? ["text"];
  return [
    {
      compat: fallback?.compat ?? FRIENDLIAI_COMPAT,
      contextWindow: positiveInteger(
        item.context_length,
        fallback?.contextWindow ?? 128_000
      ),
      cost: parseCost(toRecord(item.pricing), fallback?.cost),
      id: item.id,
      input,
      maxTokens: positiveInteger(
        item.max_completion_tokens,
        fallback?.maxTokens ?? 16_384
      ),
      name: resolveName(item, fallback),
      reasoning: fallback?.reasoning ?? false,
      thinkingLevelMap: fallback?.thinkingLevelMap,
    } satisfies ProviderModelConfig,
  ];
};

/**
 * Convert the FriendliAI /models response into Pi's model metadata.
 * Reasoning behavior is not part of the response, so it comes from the
 * fallback table; unknown models become conservative non-reasoning text
 * models.
 */
export const parseModelsResponse = (
  payload: FriendliModelsResponse
): ProviderModelConfig[] => {
  if (!Array.isArray(payload.data)) {
    return [];
  }
  const known = new Map(FALLBACK_MODELS.map((model) => [model.id, model]));
  return payload.data.flatMap((raw) => parseEntry(raw, known));
};

export const fetchModels = async (
  apiKey: string,
  signal?: AbortSignal
): Promise<ProviderModelConfig[]> => {
  const timeout = AbortSignal.timeout(10_000);
  const response = await fetch(`${FRIENDLIAI_BASE_URL}/models`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    throw new Error(`FriendliAI /models returned HTTP ${response.status}`);
  }

  const models = parseModelsResponse(
    (await response.json()) as FriendliModelsResponse
  );
  if (models.length === 0) {
    throw new Error("FriendliAI /models returned no models");
  }
  return models;
};

interface StoredCatalog {
  models?: unknown;
}

export const refreshModels: NonNullable<
  ProviderConfig["refreshModels"]
> = async (context): Promise<ProviderModelConfig[]> => {
  const stored = (await context.store.read()) as StoredCatalog | undefined;
  const cached =
    Array.isArray(stored?.models) && stored.models.length > 0
      ? (stored.models as ProviderModelConfig[])
      : FALLBACK_MODELS;
  const apiKey =
    context.credential?.type === "api_key" ? context.credential.key : undefined;
  if (!context.allowNetwork || context.signal?.aborted || !apiKey) {
    return cached;
  }

  try {
    const models = await fetchModels(apiKey, context.signal);
    // Pi validates and composes the returned models itself; the store keeps
    // the provider-level shape, matching pi's own refresh contract.
    await context.store.write({
      checkedAt: Date.now(),
      models: models as never,
    });
    return models;
  } catch {
    // Keep the last successful catalog through transient failures.
    return cached;
  }
};
