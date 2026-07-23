# pi-provider-friendli

FriendliAI provider for [Pi](https://github.com/earendil-works/pi-coding-agent) with live model discovery.

## Install

```bash
pi install npm:pi-provider-friendli
export FRIENDLI_TOKEN=your_api_key # https://friendli.ai
```

## Features

- Every FriendliAI serverless model out of the box, auto-refreshed from the live `/models` endpoint
- Verified per-million pricing, context limits, and transport compatibility per model
- Thinking toggle (off / max) for K-EXAONE and GLM; MiniMax and DeepSeek stay locked at max
