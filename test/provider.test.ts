import type {
  ExtensionAPI,
  ProviderConfig,
  ProviderModelConfig,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";

import friendliProvider, {
  FALLBACK_MODELS,
  FRIENDLIAI_BASE_URL,
} from "../src/index.ts";

type ModelCompat = ProviderModelConfig["compat"];
type OpenAICompat = Extract<
  NonNullable<ModelCompat>,
  { supportsUsageInStreaming?: boolean }
>;

const TOGGLE_MAP = {
  high: null,
  low: null,
  max: "max",
  medium: null,
  minimal: null,
  off: "none",
  xhigh: null,
};

const ALWAYS_MAP = {
  high: null,
  low: null,
  max: "max",
  medium: null,
  minimal: null,
  off: null,
  xhigh: null,
};

const openaiCompat = (compat: ModelCompat): OpenAICompat => {
  if (compat && "supportsUsageInStreaming" in compat) {
    return compat;
  }
  throw new Error("expected OpenAI completions compat");
};

interface Registration {
  name: string;
  config: ProviderConfig;
}

const captureRegistration = (): { calls: Registration[]; pi: ExtensionAPI } => {
  const calls: Registration[] = [];
  const pi = {
    registerProvider(name: string, config: ProviderConfig) {
      calls.push({ config, name });
    },
  } as ExtensionAPI;
  return { calls, pi };
};

const findModel = (id: string): ProviderModelConfig => {
  const model = FALLBACK_MODELS.find((entry) => entry.id === id);
  if (!model) {
    throw new Error(`missing fallback model ${id}`);
  }
  return model;
};

describe("friendliProvider registration", () => {
  it("registers the FriendliAI provider identity", () => {
    // Given a Pi extension API
    const { calls, pi } = captureRegistration();

    // When the extension initializes
    friendliProvider(pi);

    // Then it registers FriendliAI's serverless endpoint
    expect(calls).toHaveLength(1);
    const [registration] = calls;
    expect(registration?.name).toBe("friendli");
    expect(registration?.config.name).toBe("FriendliAI");
    expect(registration?.config.baseUrl).toBe(FRIENDLIAI_BASE_URL);
    expect(FRIENDLIAI_BASE_URL).toBe("https://api.friendli.ai/serverless/v1");
  });

  it("registers OpenAI-compatible auth and live model refresh", () => {
    // Given a Pi extension API
    const { calls, pi } = captureRegistration();

    // When the extension initializes
    friendliProvider(pi);

    // Then auth comes from the environment via an Authorization header
    const config = calls[0]?.config;
    expect(config?.apiKey).toBe("$FRIENDLI_TOKEN");
    expect(config?.api).toBe("openai-completions");
    expect(config?.authHeader).toBeTruthy();
    expect(config?.refreshModels).toBeTypeOf("function");
  });

  it("registers an OAuth login flow for /login support", () => {
    // Given a Pi extension API
    const { calls, pi } = captureRegistration();

    // When the extension initializes
    friendliProvider(pi);

    // Then the provider supports /login with an API key prompt
    const oauth = calls[0]?.config.oauth;
    expect(oauth).toBeDefined();
    expect(oauth?.name).toBe("FriendliAI");
    expect(oauth?.login).toBeTypeOf("function");
    expect(oauth?.refreshToken).toBeTypeOf("function");
    expect(oauth?.getApiKey).toBeTypeOf("function");
  });

  it("prompts for an API key during /login", async () => {
    // Given a Pi extension API
    const { calls, pi } = captureRegistration();
    friendliProvider(pi);
    const oauth = calls[0]?.config.oauth;

    // When the user logs in and enters their key
    const prompts: string[] = [];
    const credentials = await oauth?.login({
      onPrompt: (prompt) => {
        prompts.push(prompt.message);
        return Promise.resolve("flp_test_key_123");
      },
    });

    // Then the key is stored as an OAuth credential
    expect(prompts).toHaveLength(1);
    expect(credentials?.access).toBe("flp_test_key_123");
    expect(
      oauth?.getApiKey({ access: "flp_test_key_123", expires: 0, refresh: "" })
    ).toBe("flp_test_key_123");
  });

  it("returns the same credentials on refresh (API keys don't expire)", async () => {
    // Given a Pi extension API
    const { calls, pi } = captureRegistration();
    friendliProvider(pi);
    const oauth = calls[0]?.config.oauth;
    const stored = { access: "flp_key", expires: 0, refresh: "" };

    // When the credential is refreshed
    const refreshed = await oauth?.refreshToken(stored);

    // Then the same key is returned unchanged
    expect(refreshed?.access).toBe("flp_key");
  });
});

describe("fallback catalog", () => {
  it("pins the fallback catalog in stable order", () => {
    // Given the fallback catalog
    const ids = FALLBACK_MODELS.map((model) => model.id);

    // Then the documented serverless models ship in a stable order
    expect(ids).toStrictEqual([
      "Qwen/Qwen3-235B-A22B-Instruct-2507",
      "LGAI-EXAONE/K-EXAONE-236B-A23B",
      "MiniMaxAI/MiniMax-M2.5",
      "deepseek-ai/DeepSeek-V3.2",
      "zai-org/GLM-5.1",
      "google/gemma-4-31B-it",
      "zai-org/GLM-5.2",
    ]);
  });

  it("describes K-EXAONE with verified live limits", () => {
    // Given the K-EXAONE fallback entry
    const model = findModel("LGAI-EXAONE/K-EXAONE-236B-A23B");

    // Then context and output limits match the live API
    expect(model.contextWindow).toBe(262_144);
    expect(model.maxTokens).toBe(262_144);
    expect(model.reasoning).toBeTruthy();
    expect(model.input).toStrictEqual(["text"]);
  });

  it("describes K-EXAONE with verified per-million pricing", () => {
    // Given the K-EXAONE fallback entry
    const model = findModel("LGAI-EXAONE/K-EXAONE-236B-A23B");

    // Then pricing matches the official model-apis pricing
    expect(model.cost).toStrictEqual({
      cacheRead: 0.1,
      cacheWrite: 0,
      input: 0.2,
      output: 0.8,
    });
  });

  it("marks controllable reasoning models as an off/max thinking toggle", () => {
    // Given the controllable reasoning models
    const controllable = [
      "LGAI-EXAONE/K-EXAONE-236B-A23B",
      "zai-org/GLM-5.1",
      "zai-org/GLM-5.2",
    ];

    for (const id of controllable) {
      const model = findModel(id);

      // Then thinking toggles via chat_template_kwargs.enable_thinking
      expect(model.reasoning).toBeTruthy();
      expect(model.thinkingLevelMap).toStrictEqual(TOGGLE_MAP);
      expect(openaiCompat(model.compat).thinkingFormat).toBe(
        "qwen-chat-template"
      );
    }
  });

  it("locks always-reasoning models at max without sending effort params", () => {
    // Given the always-reasoning models
    const always = ["MiniMaxAI/MiniMax-M2.5", "deepseek-ai/DeepSeek-V3.2"];

    for (const id of always) {
      const model = findModel(id);

      // Then thinking cannot be turned off and no effort param is sent
      expect(model.reasoning).toBeTruthy();
      expect(model.thinkingLevelMap).toStrictEqual(ALWAYS_MAP);
      expect(openaiCompat(model.compat).supportsReasoningEffort).toBeFalsy();
      expect(openaiCompat(model.compat).thinkingFormat).toBeUndefined();
    }
  });

  it("marks Qwen3 Instruct as a plain text model", () => {
    // Given the Qwen3 Instruct fallback entry
    const qwen = findModel("Qwen/Qwen3-235B-A22B-Instruct-2507");

    // Then reasoning is off and no thinking map exists
    expect(qwen.reasoning).toBeFalsy();
    expect(qwen.thinkingLevelMap).toBeUndefined();
    expect(qwen.input).toStrictEqual(["text"]);
  });

  it("marks gemma as a non-reasoning multimodal model", () => {
    // Given the gemma fallback entry
    const gemma = findModel("google/gemma-4-31B-it");

    // Then it accepts images per the official model card
    expect(gemma.reasoning).toBeFalsy();
    expect(gemma.input).toStrictEqual(["text", "image"]);
  });

  it("pins Friendli-verified compatibility flags on every model", () => {
    for (const model of FALLBACK_MODELS) {
      const compat = openaiCompat(model.compat);

      // The developer role is rejected with HTTP 422 by the live endpoint
      expect(compat.supportsDeveloperRole).toBeFalsy();
      // max_completion_tokens and streaming usage are live-verified
      expect(compat.maxTokensField).toBe("max_completion_tokens");
      expect(compat.supportsUsageInStreaming).toBeTruthy();
    }
  });
});
