# AGENTS.md

MiNeko Harness is a plugin-based Agent Harness on vendored Cordis. Before changing code, start with [AgentGuide/README.md](AgentGuide/README.md) and open the topic guide for the affected area.

## Task authority

The active user request defines the product outcome. Repository instructions define implementation and verification constraints; they must not silently remove, narrow, or replace an explicit user requirement. Preserve existing product behavior unless removal is requested.

## Required reading

- [Repository map](AgentGuide/repository-map.md): applications, package groups, and ownership routing.
- [Architecture](AgentGuide/architecture.md): Cordis composition, capabilities, sessions, models, tools, Host/client transport, and extension points.
- [Engineering conventions](AgentGuide/conventions.md): TypeScript, lifecycle, APIs, sessions, tools, tests, and documentation.
- [Development](AgentGuide/development.md): setup, commands, focused checks, generated files, credentials, and Windows process work.
- [Electron desktop](AgentGuide/desktop.md): `pnpm run desktop`, Windows identity, renderer transport, performance, and packaging.

Read the closest package README and subtree `AGENTS.md` before editing a package or application. Source code, manifests, executable configuration, and tests are authoritative for implementation details.

## Repository rules

- Everything product-visible is composed as a plugin. Add behavior through an owned service, provider, consumer, event, or client module before considering a central loop change.
- Registrations are effects: use `ctx.effect()` or `ctx.on()` and return exact disposers.
- A capability includes its service definition, provider, and consumer roles. Keep provider defaults and consumer presentation out of the service definition.
- Every model-visible input is reconstructable from durable session data.
- Resolve defaults explicitly in the owning implementation. Deployment choices are validated configuration, not hidden constants.
- Validate parser, configuration, durable, worker, process, model/tool JSON, and wire inputs. Trust typed same-process TypeScript calls.
- Use branded identifiers across durable, process, worker, and wire interfaces.
- The repository is ESM with strict TypeScript. Use package names across workspaces and `.ts` extensions for local relative imports.
- Closed discriminated unions end in `assertNever`; merge-extensible unions use a documented default.
- Do not hand-edit generated files or generated regions. Change the owner and rerun its generator.
- Never commit credentials, runtime sessions, traces, databases, or local agent state.

## Desktop product rules

- `pnpm run desktop` is the default Windows development entry point.
- Electron owns the desktop window; Node.js owns agents, plugins, tools, sessions, models, and execution.
- Desktop assets load through `mnh://`; desktop startup does not open a Web server or TCP listener.
- Keep the transparent multi-resolution product icon without a blue or opaque square background.
- Keep the product slogan `Make Everything Happen`.
- Open and close interactions animate in both directions, including settings dismissal.
- Reasoning controls display only levels declared by the selected model adapter.

## Commands

```sh
pnpm install
pnpm run build
pnpm run desktop
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run doc-sync
```

Run the narrowest behavior check during implementation. Use repository-wide checks for cross-cutting changes, CI diagnosis, or release rehearsal.

## Documentation

`docs/` contains user and developer tutorials. `AgentGuide/` contains repository-wide agent and maintainer reference. Package behavior belongs in package READMEs and public JSDoc. Write current behavior, keep one owner per fact, and use relative Markdown links.

Files end with exactly one trailing newline. Preserve unrelated user changes in a dirty worktree and never use destructive Git commands without explicit authorization.
