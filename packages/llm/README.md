# llm/ — LLM capability family

English | [中文](README.zh.md)

The LLM seam and its provider adapters. The `llm` package owns both the Service Definition and Consumer roles: the abstract service, content-block vocabulary, and stream-chunk assembler. Provider adapters register on `ctx.llm`. All **product** packages.

| Package | Role | ctx key |
|---|---|---|
| [`llm/`](llm/README.md) | LLM service and shared streaming vocabulary | `ctx.llm` |
| [`token-meter/`](token-meter/README.md) | Replay-aware token measurement | `ctx.tokenMeter` |
| [`llm-retry/`](llm-retry/README.md) | Provider-scoped retry policy | listens to `agent/request-error` |
| [`llm-deepseek/`](llm-deepseek/README.md) | Direct DeepSeek adapter | registers on `ctx.llm` |
| [`llm-pi-ai/`](llm-pi-ai/README.md) | Multi-provider pi-ai adapter | registers on `ctx.llm` |

Adapters register provider routes on the seam; retry and token measurement remain separate consumers. The child READMEs own routing, metadata, replay, and provider-wire details; the [LLM architecture decisions](../../AgentGuide/architecture.md) own the rationale.

The subsystem reference — messages and blocks, the model request, the `StreamChunk` protocol, the adapter contract — is [AgentGuide/reference/subsystems/llm-streaming.md](../../AgentGuide/reference/subsystems/llm-streaming.md) (token measurement: [token-meter.md](../../AgentGuide/reference/subsystems/token-meter.md)); see the [twin adapters](../../AgentGuide/architecture.md), [replay token meter](../../AgentGuide/architecture.md), and [routed model context](../../AgentGuide/architecture.md) Agent Notes.
