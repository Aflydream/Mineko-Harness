# MiNeko Harness Agent Guide

This directory is the maintained entry point for coding agents working in MiNeko Harness. It describes the current repository, its ownership rules, and the shortest path from a user request to the correct implementation and verification.

## Start here

1. Read [repository-map.md](repository-map.md) to locate the owning application or package group.
2. Read [architecture.md](architecture.md) before changing runtime composition, sessions, model routing, tools, transports, or plugin lifecycle.
3. Read [conventions.md](conventions.md) before editing TypeScript or package APIs.
4. Use [development.md](development.md) to select commands and focused checks.
5. Read [desktop.md](desktop.md) for Electron, Windows identity, packaging, and `pnpm run desktop`.

The user request is the product authority for the active task. Repository guidance supplies implementation constraints and verification expectations; it must not silently replace or reduce an explicit user requirement.

## Repository snapshot

| Measure | Current value |
|---|---:|
| Product version | `0.1.0` |
| Supported Node.js | `^22.19.0` or `>=24.0.0` |
| Package manager | `pnpm@11.7.0` |
| Harness packages | 221 |
| Package groups | 49 |
| Application projects | 3 |
| Shipped profile templates | 3 |
| Profile bundle packages | 4 |

The counts are a navigation aid, not a compatibility promise. [`package.json`](../package.json), [`pnpm-workspace.yaml`](../pnpm-workspace.yaml), package manifests, and source trees remain authoritative.

## Product invariants

- MiNeko Harness is a plugin-based Agent Harness on vendored Cordis. Product behavior belongs in plugins and capability providers, not in a growing central loop.
- `pnpm run desktop` is the default Windows development entry point. Electron owns the desktop window; Node.js runs the Harness host, plugins, tools, sessions, and model adapters.
- The desktop renderer is the complete built client served through the private `mnh://` protocol. Desktop startup does not open a Web server or TCP listener.
- Model and reasoning choices come from adapter-owned catalogs. The interface exposes only the reasoning levels declared by the selected model.
- Every model-visible input must be reconstructable from durable session data.
- Existing product features are preserved unless the user explicitly requests their removal.

## Documentation layout

`docs/` contains ordered tutorials and user guides. Agent and maintainer reference material belongs in `AgentGuide/`. Package-specific behavior belongs in the package README and public JSDoc.

- [Use the product](../docs/user/guide/index.md)
- [Build a Harness plugin](../docs/user/develop/basic/index.md)
- [Learn Cordis through exercises](../docs/cordis-tutorial/index.md)
- [Follow focused implementation cookbooks](../docs/cookbook/adding-a-package.md)

## First commands

```sh
pnpm install
pnpm run build
pnpm run desktop
```

Use the narrowest relevant check while iterating. Run repository-wide checks only when the change truly crosses the corresponding ownership boundaries.
