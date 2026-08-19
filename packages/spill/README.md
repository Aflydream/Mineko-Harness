# spill/ — tool-output spill capability family

English | [中文](README.zh.md)

This family persists oversized tool output and replaces the inline result with a bounded preview and retrieval locator.

| Package | Role | ctx key |
|---|---|---|
| [`spill/`](spill/README.md) | Defines spill storage | `ctx.spillStore` |
| [`spill-local/`](spill-local/README.md) | Stores spilled text in session-scoped local files | registers on `ctx.spillStore` |
| [`spill-policy/`](spill-policy/README.md) | Applies the post-execution spill policy | listens on `ctx.tools` |

See the [tool-output spill decision](../../AgentGuide/architecture.md) for the boundary between storage, retention, and tool-owned output handling.

The subsystem reference — `SaveTextSpill`, owners/sources, the branded locator — is [AgentGuide/reference/subsystems/spill.md](../../AgentGuide/reference/subsystems/spill.md); rationale in the [tool output spill Agent Note](../../AgentGuide/architecture.md).
