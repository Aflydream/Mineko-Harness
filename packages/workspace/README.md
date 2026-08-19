# workspace/ — workspace entity family

English | [中文](README.zh.md)

This family owns persistent workspaces: user directories with titles and ordered session membership.

| Package | Role | ctx key |
|---|---|---|
| [`workspace/`](workspace/README.md) | Registers workspaces and accounts for their sessions | `ctx.workspaceRegistry` |

The [workspace package reference](workspace/README.md) owns lifecycle, persistence, and deletion semantics.

The subsystem reference — the entity, realpath canon, registration/resolution — is [AgentGuide/reference/subsystems/workspace.md](../../AgentGuide/reference/subsystems/workspace.md); storage design in the [domain KV storage Agent Note](../../AgentGuide/architecture.md).
