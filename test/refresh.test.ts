import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FALLBACK_MODELS,
  FRIENDLIAI_BASE_URL,
  fetchModels,
  refreshModels,
} from "../src/index.ts";

type FetchArgs = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

interface StoredEntry {
  checkedAt?: number;
  models: ProviderModelConfig[];
}

const parseFixtures = (ids: string[]): ProviderModelConfig[] =>
  ids.map((id) => ({
    contextWindow: 128_000,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
    id,
    input: ["text"],
    maxTokens: 16_384,
    name: id,
    reasoning: false,
  }));

const createStore = (initial?: StoredEntry) => {
  let entry = initial;
  return {
    delete: () => {
      entry = undefined;
      return Promise.resolve();
    },
    get entry() {
      return entry;
    },
    read: () => Promise.resolve(entry),
    write: (value: StoredEntry) => {
      entry = value;
      return Promise.resolve();
    },
  };
};

const catalogResponse = (ids: string[] = []): Promise<Response> =>
  Promise.resolve(Response.json({ data: ids.map((id) => ({ id })) }));

const failingResponse = (): Promise<Response> =>
  Promise.resolve(new Response("unavailable", { status: 503 }));

describe("fetchModels HTTP behavior", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the catalog endpoint with bearer authentication", async () => {
    // Given a successful FriendliAI /models response
    const fetchMock = vi.fn<FetchArgs>(() => catalogResponse(["acme/New-1"]));
    vi.stubGlobal("fetch", fetchMock);

    // When the catalog is fetched
    await fetchModels("secret");

    // Then the request targets the authenticated endpoint
    expect(fetchMock).toHaveBeenCalledOnce();
    const [call] = fetchMock.mock.calls;
    if (!call) {
      throw new Error("fetch was not called");
    }
    const [url, init] = call;
    expect(String(url)).toBe(`${FRIENDLIAI_BASE_URL}/models`);
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer secret"
    );
  });

  it("parses the catalog response into model metadata", async () => {
    // Given a rich FriendliAI /models response
    const fetchMock = vi.fn<FetchArgs>(() =>
      Promise.resolve(
        Response.json({
          data: [
            {
              context_length: 65_536,
              id: "acme/New-1",
              max_completion_tokens: 4096,
              name: "acme/New-1",
              pricing: { completion: "0.000002", prompt: "0.000001" },
            },
          ],
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    // When the catalog is fetched
    const models = await fetchModels("secret");

    // Then the model is parsed with per-million pricing
    expect(models[0]?.id).toBe("acme/New-1");
    expect(models[0]?.cost.input).toBe(1);
    expect(models[0]?.cost.output).toBe(2);
  });

  it("throws when the endpoint returns an error status", async () => {
    // Given an unavailable endpoint
    vi.stubGlobal("fetch", vi.fn<FetchArgs>(failingResponse));

    // Then the error names the status
    await expect(fetchModels("secret")).rejects.toThrow(/503/u);
  });

  it("throws when the endpoint returns no models", async () => {
    // Given an empty catalog
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchArgs>(() => catalogResponse())
    );

    // Then the failure is explicit instead of a silent empty catalog
    await expect(fetchModels("secret")).rejects.toThrow(/no models/iu);
  });
});

describe("refreshModels caching", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("publishes discovered models and persists them with a timestamp", async () => {
    // Given network access and a valid credential
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchArgs>(() => catalogResponse(["acme/A", "acme/B"]))
    );
    const store = createStore();

    // When the catalog refreshes
    const models = await refreshModels({
      allowNetwork: true,
      credential: { key: "secret", type: "api_key" },
      store: store as never,
    });

    // Then the discovered catalog is returned and persisted
    expect(models.map((model) => model.id)).toStrictEqual(["acme/A", "acme/B"]);
    expect(store.entry?.models.map((model) => model.id)).toStrictEqual([
      "acme/A",
      "acme/B",
    ]);
    expect(store.entry?.checkedAt).toBeTypeOf("number");
  });

  it("keeps the last successful catalog through transient failures", async () => {
    // Given a previously cached catalog and a failing endpoint
    const cached = parseFixtures(["acme/cached-a", "acme/cached-b"]);
    const store = createStore({ checkedAt: 123, models: cached });
    vi.stubGlobal("fetch", vi.fn<FetchArgs>(failingResponse));

    // When the refresh fails
    const models = await refreshModels({
      allowNetwork: true,
      credential: { key: "secret", type: "api_key" },
      store: store as never,
    });

    // Then the cached catalog survives
    expect(models.map((model) => model.id)).toStrictEqual([
      "acme/cached-a",
      "acme/cached-b",
    ]);
  });

  it("returns the fallback catalog without a credential", async () => {
    // Given no resolved credential
    const store = createStore();

    // When the refresh runs
    const models = await refreshModels({
      allowNetwork: true,
      store: store as never,
    });

    // Then the offline fallback catalog is used
    expect(models).toBe(FALLBACK_MODELS);
  });

  it("returns the fallback catalog when the first fetch fails", async () => {
    // Given no cached catalog and a failing endpoint
    const store = createStore();
    vi.stubGlobal("fetch", vi.fn<FetchArgs>(failingResponse));

    // When the refresh fails
    const models = await refreshModels({
      allowNetwork: true,
      credential: { key: "secret", type: "api_key" },
      store: store as never,
    });

    // Then the fallback catalog is used
    expect(models).toBe(FALLBACK_MODELS);
  });

  it("serves the cache without network access", async () => {
    // Given network access is disabled
    const fetchMock = vi.fn<FetchArgs>();
    vi.stubGlobal("fetch", fetchMock);
    const cached = parseFixtures(["acme/cached"]);
    const store = createStore({ models: cached });

    // When the refresh runs offline
    const models = await refreshModels({
      allowNetwork: false,
      credential: { key: "secret", type: "api_key" },
      store: store as never,
    });

    // Then the cache is served and no request is made
    expect(models.map((model) => model.id)).toStrictEqual(["acme/cached"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
