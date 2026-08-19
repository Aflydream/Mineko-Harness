# sandbox/ — process-sandbox capability family

English | [中文](README.zh.md)

This family applies per-session confinement policy to process execution. It covers same-world subprocesses; isolated environments replace complete capability implementations instead of registering here.

| Package | Role | ctx key |
|---|---|---|
| [`sandbox/`](sandbox/README.md) | Defines the process-sandbox service and shared escalation vocabulary | `ctx.sandbox` |
| [`sandbox-local/`](sandbox-local/README.md) | Provides local platform confinement backends | registers on `ctx.sandbox` |
| [`sandbox-policy/`](sandbox-policy/README.md) | Resolves durable per-session sandbox policy | `ctx.sandboxPolicy` |

See the [sandbox decision](../../AgentGuide/conventions.md) for the capability boundary and the [filesystem integration decision](../../AgentGuide/conventions.md) for cross-family policy use.

The subsystem reference — modes and enforcement, per-call policy, wrapped-argv dialects, fail-closed errors — is [AgentGuide/reference/subsystems/sandbox.md](../../AgentGuide/reference/subsystems/sandbox.md); the boundary and the cross-family phase live in the [sandbox](../../AgentGuide/conventions.md) and [cross-family fs sandbox](../../AgentGuide/conventions.md) Agent Notes.
