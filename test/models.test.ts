import { describe, expect, it } from "vitest";

import { parseModelsResponse } from "../src/index.ts";

const TOGGLE_MAP = {
  high: null,
  low: null,
  max: "max",
  medium: null,
  minimal: null,
  off: "none",
  xhigh: null,
};

// Real shape captured from GET /serverless/v1/models (2026-07-23).
const K_EXAONE_ENTRY = {
  context_length: 262_144,
  created: 1_767_166_200,
  functionality: {
    builtin_tool: true,
    parallel_tool_call: true,
    structured_output: true,
    tool_call: true,
  },
  hugging_face_id: "LGAI-EXAONE/K-EXAONE-236B-A23B",
  id: "LGAI-EXAONE/K-EXAONE-236B-A23B",
  max_completion_tokens: 262_144,
  name: "LGAI-EXAONE/K-EXAONE-236B-A23B",
  pricing: {
    completion: "0.0000008",
    input: "0.0000002",
    input_cache_read: "0.0000001",
    output: "0.0000008",
    prompt: "0.0000002",
  },
};

describe("parseModelsResponse catalog parsing", () => {
  it("parses the rich Friendli shape with per-token to per-million pricing", () => {
    // Given a live-shaped payload for a known model
    const models = parseModelsResponse({ data: [K_EXAONE_ENTRY] });

    // Then metadata comes from the response, reasoning from the known table
    expect(models).toHaveLength(1);
    expect(models[0]).toStrictEqual({
      compat: {
        maxTokensField: "max_completion_tokens",
        supportsDeveloperRole: false,
        supportsUsageInStreaming: true,
        thinkingFormat: "qwen-chat-template",
      },
      contextWindow: 262_144,
      cost: { cacheRead: 0.1, cacheWrite: 0, input: 0.2, output: 0.8 },
      id: "LGAI-EXAONE/K-EXAONE-236B-A23B",
      input: ["text"],
      maxTokens: 262_144,
      name: "K-EXAONE 236B A23B",
      reasoning: true,
      thinkingLevelMap: TOGGLE_MAP,
    });
  });

  it("treats unknown models conservatively as non-reasoning text models", () => {
    // Given a model the fallback table does not know
    const models = parseModelsResponse({
      data: [
        {
          context_length: 32_768,
          id: "acme/Future-7B",
          max_completion_tokens: 8192,
          name: "acme/Future-7B",
          pricing: { completion: "0.0000001", prompt: "0.00000005" },
        },
      ],
    });

    // Then it stays usable without reasoning-specific request params
    expect(models).toHaveLength(1);
    expect(models[0]).toStrictEqual({
      compat: {
        maxTokensField: "max_completion_tokens",
        supportsDeveloperRole: false,
        supportsUsageInStreaming: true,
      },
      contextWindow: 32_768,
      cost: { cacheRead: 0, cacheWrite: 0, input: 0.05, output: 0.1 },
      id: "acme/Future-7B",
      input: ["text"],
      maxTokens: 8192,
      name: "Future 7B",
      reasoning: false,
      thinkingLevelMap: undefined,
    });
  });

  it("keeps table limits when the response only carries an id", () => {
    // Given a minimal OpenAI-shaped entry for a known model
    const models = parseModelsResponse({ data: [{ id: "zai-org/GLM-5.2" }] });

    // Then the fallback metadata fills every gap
    expect(models[0]?.name).toBe("GLM 5.2");
    expect(models[0]?.contextWindow).toBe(1_048_576);
    expect(models[0]?.maxTokens).toBe(1_048_576);
    expect(models[0]?.cost).toStrictEqual({
      cacheRead: 0.26,
      cacheWrite: 0,
      input: 1.4,
      output: 4.4,
    });
  });

  it("keeps table reasoning config when the response only carries an id", () => {
    // Given a minimal OpenAI-shaped entry for a known model
    const models = parseModelsResponse({ data: [{ id: "zai-org/GLM-5.2" }] });

    // Then the controllable reasoning behavior survives the refresh
    expect(models[0]?.reasoning).toBeTruthy();
    expect(models[0]?.thinkingLevelMap).toStrictEqual(TOGGLE_MAP);
  });

  it("skips entries without a usable id", () => {
    // Given malformed entries
    const models = parseModelsResponse({
      data: [
        { name: "no id", object: "model" },
        null,
        "LGAI-EXAONE/K-EXAONE-236B-A23B",
        { id: "" },
        { id: "google/gemma-4-31B-it" },
      ],
    });

    // Then only the valid entry survives
    expect(models.map((model) => model.id)).toStrictEqual([
      "google/gemma-4-31B-it",
    ]);
    expect(models[0]?.input).toStrictEqual(["text", "image"]);
  });

  it("rejects non-array payloads", () => {
    // Given payloads whose data field is not an array
    // Then parsing yields nothing instead of crashing
    expect(parseModelsResponse({})).toStrictEqual([]);
    expect(parseModelsResponse({ data: "nope" })).toStrictEqual([]);
  });

  it("uses the display name from the response when it differs from the id", () => {
    // Given an entry whose name is a real display name
    const models = parseModelsResponse({
      data: [{ id: "acme/Future-7B", name: "Future 7B Instruct" }],
    });

    // Then the display name wins over the derived one
    expect(models[0]?.name).toBe("Future 7B Instruct");
  });
});
