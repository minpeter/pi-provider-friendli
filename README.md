# pi-provider-friendli

FriendliAI model provider for [Pi](https://github.com/earendil-works/pi-coding-agent) with live model discovery.

Ships with the full FriendliAI serverless catalog and refreshes it against the live [`/models`](https://api.friendli.ai/serverless/v1/models) endpoint, so new models appear automatically.

## Features

- **Works out of the box** — all current serverless models are bundled as a fallback catalog
- **Live model discovery** — resolves `FRIENDLI_TOKEN`, fetches the catalog, and caches it; Pi falls back to the bundled catalog when the endpoint is unreachable
- **Accurate metadata** — context/output limits from the live endpoint and per-million pricing converted from FriendliAI's per-token rates (cached-token pricing included where offered)
- **Verified transport flags** — every compat flag was probed against the live endpoint: `max_completion_tokens`, streaming usage, no `developer` role (rejected with HTTP 422)
- **Thinking control** — controllable reasoning models toggle thinking through FriendliAI's `chat_template_kwargs.enable_thinking`

## Models

| Model | Context | Thinking | Notes |
| --- | --- | --- | --- |
| `LGAI-EXAONE/K-EXAONE-236B-A23B` | 262,144 | off / max | controllable, cached-input pricing |
| `MiniMaxAI/MiniMax-M2.5` | 196,608 | always on | locked at max |
| `deepseek-ai/DeepSeek-V3.2` | 163,840 | always on | locked at max |
| `zai-org/GLM-5.1` | 202,752 | off / max | controllable |
| `zai-org/GLM-5.2` | 1,048,576 | off / max | controllable |
| `Qwen/Qwen3-235B-A22B-Instruct-2507` | 262,144 | — | non-reasoning |
| `google/gemma-4-31B-it` | 262,144 | — | non-reasoning, image input |

Controllable models expose thinking as a toggle: **off** sends `chat_template_kwargs.enable_thinking: false` (fast, no reasoning tokens) and **max** enables it (reasoning is parsed out of the response for you). Always-reasoning models stay locked at max and never receive thinking parameters.

## Installation

```bash
pi install npm:pi-provider-friendli
```

This package ships as a Pi extension, no other configuration needed.

## Authentication

```bash
export FRIENDLI_TOKEN=your_api_key_here
```

You can get an API key from [FriendliAI](https://friendli.ai). When no key is available, the provider still works through Pi's normal key resolution and serves the bundled fallback catalog.

## Model metadata

Context/output limits and per-million pricing are refreshed from `GET /serverless/v1/models` on startup and stored in Pi's model cache. Reasoning behavior and transport compatibility come from a curated table keyed by model id (FriendliAI does not expose them on the API); models the table does not know are treated conservatively as non-reasoning text models. If the refresh fails, the last successful catalog is kept; if none exists, the bundled fallback is used.

## Development

Requires Node.js 24+ and pnpm.

```bash
pnpm install
pnpm check       # oxlint + oxfmt + tsc --noEmit + vitest
```

Linting and formatting use [Ultracite](https://www.ultracite.ai)'s Oxlint + Oxfmt presets; releases use [Tegami](https://tegami.fuma-nama.dev) with OIDC-provenanced npm publishing.

Live tests hit the real API and are excluded from `pnpm check`:

```bash
FRIENDLI_TOKEN=... pnpm test:live
```

Changelog entries live in `.tegami/*.md` (see the [Tegami changelog format](https://tegami.fuma-nama.dev/changelog)); the release workflow versions and publishes via `pnpm tegami ci`.

## License

MIT
