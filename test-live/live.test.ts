import type {
  AssistantMessage,
  Context,
  Model,
  Tool,
} from "@earendil-works/pi-ai";
import { streamSimple } from "@earendil-works/pi-ai/compat";
import { describe, expect, it } from "vitest";

import {
  FALLBACK_MODELS,
  FRIENDLIAI_BASE_URL,
  fetchModels,
} from "../src/index.ts";

const API_KEY = process.env.FRIENDLI_TOKEN;
if (API_KEY === undefined || API_KEY.length === 0) {
  throw new Error("FRIENDLI_TOKEN is required for the live test suite");
}

const K_EXAONE = "LGAI-EXAONE/K-EXAONE-236B-A23B";

type OpenAIModel = Model<"openai-completions">;

const friendliModel = (id: string): OpenAIModel => {
  const fallback = FALLBACK_MODELS.find((model) => model.id === id);
  if (!fallback) {
    throw new Error(`unknown fallback model ${id}`);
  }
  return {
    ...fallback,
    api: "openai-completions",
    baseUrl: FRIENDLIAI_BASE_URL,
    provider: "friendliai",
  };
};

const chatWithPayload = async (
  model: OpenAIModel,
  prompt: string,
  options: { reasoning?: "off" | "max"; tools?: Tool[] } = {}
): Promise<{ message: AssistantMessage; payload: unknown }> => {
  const context: Context = {
    messages: [
      {
        content: [{ text: prompt, type: "text" }],
        role: "user",
        timestamp: Date.now(),
      },
    ],
    ...(options.tools ? { tools: options.tools } : {}),
  };
  let payload: unknown;
  // Pi expresses "off" on the wire by omitting the reasoning level, which
  // the qwen-chat-template compat maps to enable_thinking: false.
  const stream = streamSimple(model, context, {
    apiKey: API_KEY,
    onPayload: (raw) => {
      payload = raw;
    },
    ...(options.reasoning === "max" ? { reasoning: "max" as const } : {}),
  });
  for await (const event of stream) {
    void event;
  }
  return { message: await stream.result(), payload };
};

const chat = async (
  model: OpenAIModel,
  prompt: string,
  options: { reasoning?: "off" | "max"; tools?: Tool[] } = {}
): Promise<AssistantMessage> => {
  const { message } = await chatWithPayload(model, prompt, options);
  return message;
};

const textOf = (message: AssistantMessage): string =>
  message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

const thinkingOf = (message: AssistantMessage): string =>
  message.content
    .filter((block) => block.type === "thinking")
    .map((block) => block.thinking)
    .join("");

describe("FriendliAI live catalog", () => {
  it("serves the full serverless catalog with table reasoning metadata", async () => {
    // Given the live /models endpoint
    const models = await fetchModels(API_KEY);
    const ids = models.map((model) => model.id);

    // Then every fallback model is discoverable on the live endpoint
    expect(ids).toStrictEqual(
      expect.arrayContaining([
        "Qwen/Qwen3-235B-A22B-Instruct-2507",
        K_EXAONE,
        "MiniMaxAI/MiniMax-M2.5",
        "deepseek-ai/DeepSeek-V3.2",
        "zai-org/GLM-5.1",
        "google/gemma-4-31B-it",
        "zai-org/GLM-5.2",
      ])
    );
  });

  it("reports live K-EXAONE pricing and limits", async () => {
    // Given the live /models endpoint
    const models = await fetchModels(API_KEY);
    const kExaone = models.find((model) => model.id === K_EXAONE);
    if (!kExaone) {
      throw new Error("K-EXAONE missing from live catalog");
    }

    // Then pricing is converted to per-million rates and limits are live
    expect(kExaone.cost.input).toBe(0.2);
    expect(kExaone.cost.output).toBe(0.8);
    expect(kExaone.cost.cacheRead).toBe(0.1);
    expect(kExaone.contextWindow).toBe(262_144);
    expect(kExaone.reasoning).toBeTruthy();
  });
});

describe("K-EXAONE live chat through pi's openai-completions transport", () => {
  it("answers without thinking content when thinking is off", async () => {
    // Given a K-EXAONE request with thinking disabled
    const message = await chat(
      friendliModel(K_EXAONE),
      "Reply with exactly: PONG",
      {
        reasoning: "off",
      }
    );

    // Then the answer is direct and no reasoning is produced
    expect(message.stopReason).toBe("stop");
    expect(textOf(message)).toContain("PONG");
    expect(thinkingOf(message)).toBe("");
  });

  it("streams parsed reasoning when thinking is max", async () => {
    // Given a K-EXAONE request with thinking enabled
    const message = await chat(
      friendliModel(K_EXAONE),
      "Reply with exactly: PONG",
      { reasoning: "max" }
    );

    // Then reasoning_content is parsed into thinking blocks
    expect(message.stopReason).toBe("stop");
    expect(textOf(message)).toContain("PONG");
    expect(thinkingOf(message).length).toBeGreaterThan(0);
  });

  it("calls tools with parsed arguments", async () => {
    // Given a weather tool and a prompt that requires it
    const tools: Tool[] = [
      {
        description: "Get the current weather for a city",
        name: "get_weather",
        parameters: {
          additionalProperties: false,
          properties: { city: { type: "string" } },
          required: ["city"],
          type: "object",
        },
      },
    ];
    const message = await chat(
      friendliModel(K_EXAONE),
      "What is the weather in Seoul right now? You must call the get_weather tool.",
      { reasoning: "max", tools }
    );

    // Then the model calls the tool with a parsed city argument
    const toolCalls = message.content.filter(
      (block) => block.type === "toolCall"
    );
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]?.name).toBe("get_weather");
    expect(String(toolCalls[0]?.arguments.city)).toContain("Seoul");
  });

  it("sends enable_thinking through chat_template_kwargs on the wire", async () => {
    // Given a controllable reasoning model
    const model = friendliModel(K_EXAONE);

    // When thinking is max
    const on = await chatWithPayload(model, "Reply with exactly: PONG", {
      reasoning: "max",
    });

    // Then the payload toggles the chat template without effort params
    expect(on.payload).toMatchObject({
      chat_template_kwargs: { enable_thinking: true, preserve_thinking: true },
    });
    expect(on.payload).not.toHaveProperty("reasoning_effort");

    // And when thinking is off
    const off = await chatWithPayload(model, "Reply with exactly: PONG");

    // Then the payload disables thinking instead of sending effort
    expect(off.payload).toMatchObject({
      chat_template_kwargs: { enable_thinking: false },
    });
    expect(off.payload).not.toHaveProperty("reasoning_effort");
  });

  it("sends no thinking parameters for always-reasoning models", async () => {
    // Given an always-reasoning model with thinking locked at max
    const { payload } = await chatWithPayload(
      friendliModel("MiniMaxAI/MiniMax-M2.5"),
      "Say hi.",
      { reasoning: "max" }
    );

    // Then neither an effort param nor a chat-template toggle is sent
    expect(payload).not.toHaveProperty("reasoning_effort");
    expect(payload).not.toHaveProperty("chat_template_kwargs");
  });

  it("keeps thinking locked on for always-reasoning models", async () => {
    // Given an always-reasoning model with thinking explicitly requested off
    const message = await chat(
      friendliModel("MiniMaxAI/MiniMax-M2.5"),
      "Say hi.",
      { reasoning: "off" }
    );

    // Then no disable parameter is sent and the model still reasons
    expect(message.stopReason).toBe("stop");
    expect(thinkingOf(message).length).toBeGreaterThan(0);
    expect(textOf(message).length).toBeGreaterThan(0);
  });
});
