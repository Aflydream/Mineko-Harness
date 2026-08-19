# subagent/ — subagent capability family

English | [中文](README.zh.md)

This family lets an agent delegate work to child agents. Multiple named providers may coexist in one context.

| Package | Role | ctx key |
|---|---|---|
| [`subagent/`](subagent/README.md) | Defines provider registration, delegation, and continuation | `ctx.subagents` |
| [`subagent-inprocess/`](subagent-in-process-driver/README.md) | Provides the shared in-process run driver | — |
| [`subagent-spawn-in-process/`](subagent-spawn-in-process/README.md) | Starts a fresh in-process child | registers on `ctx.subagents` |
| [`subagent-fork-in-process/`](subagent-fork-in-process/README.md) | Starts an in-process child from the parent's completed history | registers on `ctx.subagents` |
| [`subagent-acp/`](subagent-acp/README.md) | Starts an out-of-process child over ACP | registers on `ctx.subagents` |
| [`subagent-codex/`](subagent-codex/README.md) | Starts a real Codex app-server child | registers on `ctx.subagents` |
| [`subagent-claude-code/`](subagent-claude-code/README.md) | Starts a real Claude Code child through the official Claude Agent SDK | registers on `ctx.subagents` |
| [`subagent-mnh-sdk/`](subagent-mnh-sdk/README.md) | Starts an out-of-process Harness child through the TypeScript SDK | registers on `ctx.subagents` |
| [`tool-subagent/`](tool-subagent/README.md) | Exposes delegation to the model | registers on `ctx.tools` |
| [`tool-subagent-control/`](tool-subagent-control/README.md) | Exposes child messaging and listing to the model | registers on `ctx.tools` |
| [`tool-subagent-report/`](tool-subagent-report/README.md) | Provides the child-to-parent report channel | registers in child scopes |

See the decisions for the [capability family](../../AgentGuide/conventions.md), [continuable children](../../AgentGuide/conventions.md), and [control tools](../../AgentGuide/conventions.md).

The subsystem reference — start requests, results, live runs, the provider contract, continuable background children — is [AgentGuide/reference/subsystems/subagent.md](../../AgentGuide/reference/subsystems/subagent.md); design rationale in the [subagent capability seam](../../AgentGuide/conventions.md), [continuable background subagents](../../AgentGuide/conventions.md), and [merged subagent control service](../../AgentGuide/conventions.md) Agent Notes.
