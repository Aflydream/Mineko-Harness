# Repository Map

MiNeko Herness separates product assemblies, plugin capabilities, runnable examples, platform support, and documentation. Start from the user-visible behavior and follow ownership inward.

## Top-level directories

| Path | Responsibility |
|---|---|
| `apps/desktop/` | Electron main process, preload bridge, Windows identity, release staging, and desktop tests |
| `apps/cli/` | `mnh` command parsing, profile boot, plugin management, and desktop launch dispatch |
| `apps/web/` | Vite entry and distributable renderer assets consumed by Web and desktop carriers |
| `packages/` | Product capabilities, providers, consumers, bundles, host/client modules, and SDKs |
| `examples/` | Runnable Cordis compositions used by demos, snapshots, and end-to-end checks |
| `native/` | Isolated native helpers; these do not define the default desktop UI |
| `python/` | Python SDK and the bundled JSON-RPC runtime |
| `vendor/` | Pinned Cordis and related upstream source |
| `docs/` | User, plugin-authoring, cookbook, and Cordis tutorials |
| `AgentGuide/` | Coding-agent onboarding, architecture, ownership, and engineering rules |
| `website/` | VitePress projection of selected tutorial pages |
| `scripts/` | Builds, generators, release tooling, static checks, and documentation checks |

## Package groups

The 49 package groups are easier to navigate by role than by name.

| Role | Main groups | What they own |
|---|---|---|
| Agent core | `core`, `context`, `compaction`, `guard`, `plan`, `goal`, `todo`, `schedule` | Agent lifecycle, durable events, request context, context pressure, turn controls, and scheduled follow-ups |
| Models and model extensions | `llm`, `skill`, `mcp` | Provider catalogs, adapters, streaming, retries, token accounting, reasoning metadata, skills, and MCP integration |
| Execution | `shell`, `subprocess`, `terminal`, `fs`, `lsp`, `code-runtime`, `web`, `sandbox`, `e2b` | Replaceable local, remote, or sandboxed execution capabilities and tool consumers |
| Durable data and settings | `session`, `session-query`, `settings`, `credentials`, `storage`, `identity`, `attachment`, `spill`, `workspace` | Persistence, projections, queries, settings, credentials, identities, attachments, large results, and workspace records |
| Delegation | `subagent`, `workflow`, `jobs` | Child-agent providers, workflow workers, background jobs, and control tools |
| API and product bridges | `api`, `sdk`, `typert`, `acp`, `hooks` | RPC contracts, generated clients, remote access, SDKs, automation protocols, and Codex or Claude Code hook bridges |
| Human interface | `interaction`, `feedback`, `client`, `host` | Approvals, commands, questions, permissions, feedback, renderer modules, Host bridges, and app-shell integration |
| Product composition | `bundle`, `preset`, `boot`, `examples`, `extensions` | Installable profiles, preset composition, startup, assembled examples, and live extension management |
| Engineering support | `test-support`, `runtime-diagnostics`, `util` | Test infrastructure, invariants, diagnostics, brands, and zero-dependency helpers |

## Ownership routing

- A model request or provider behavior starts in `packages/llm/` and the consuming preset or bundle.
- A tool starts at its capability definition, provider, and tool consumer. Keep all three roles complete when introducing a new capability.
- A desktop-window or Windows integration issue starts in `apps/desktop/` and `packages/host/desktop-bridge/`.
- A shared interface issue starts in `packages/client/`; `apps/web/` owns only the Vite application entry and output.
- A remote-control or mobile companion feature starts in `packages/api/remotes/`, the SDK protocol packages, session projection, and an authenticated Internet relay. No Android application or relay is currently shipped.
- A session format or replay issue starts in `packages/core/session/` and `packages/session/`; durable format changes require coordinated readers, writers, and projections.

## Local instructions

Read the closest package README before editing a package. Subtree `AGENTS.md` files add local constraints where present. Source code, package manifests, executable configurations, and tests take precedence over stale prose.
