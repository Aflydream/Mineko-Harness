# Engineering Conventions

## TypeScript and packages

- The repository is ESM and compiles with strict TypeScript settings.
- Every package is named `@aflydream/mnh-<name>`; vendored packages are private and rescope their upstream names.
- Use package imports across workspaces and `.ts` extensions for local relative source imports.
- Closed discriminated unions end in `assertNever`. Merge-extensible unions use a documented default.
- Cross-process, durable, worker, model, and tool identifiers use branded types instead of bare strings.
- Public exports document non-obvious failure, timing, cancellation, ownership, and durability behavior.

## Plugins and lifecycle

- Registrations are effects. Use `ctx.effect()` or `ctx.on()`, and return the exact disposer from registries.
- Waterfall listeners call `next()` when they delegate. Returning without it intentionally terminates the chain.
- Optional services use explicit lookup and fail at the earliest point where a required dependency can be resolved.
- One asynchronous operation has one lifecycle controller or transaction. Readiness, cancellation, rollback, and disposal must converge before ownership is released.
- Empty `catch` blocks name the exact failure being swallowed and why no other failure can reach the statement.

## APIs and configuration

- Resolve defaults in an explicit `resolve(request): spec` step owned by the implementation.
- Deployment-varying choices are validated configuration fields, not hidden constants.
- Validate untrusted data at parser, configuration, queue, durable file, process, worker, model/tool JSON, and wire inputs.
- Trust typed values at same-process TypeScript call sites unless they cross one of those inputs.
- Publish events and derived state after successful commit, never before it.

## Sessions and model context

- A value that reaches a model request must be reconstructable from the session log.
- Durable event readers reject unknown required event types; only explicitly ignorable events may be skipped.
- Session format changes update writers, readers, replay, projections, SDK contracts, and assembled fixtures together.
- Reasoning effort, context limits, and token defaults are adapter declarations projected by consumers.

## Tools

- Decide render intent when designing a tool: generic, terminal, diff, or location-aware presentation.
- Presentation is a pure function of arguments and results; tool execution does not import interface code.
- Enforce limits on complete emitted and retained values, including wrappers and metadata.
- A background job owns its cancellation after publication. Cancelling the initiating tool call must not silently destroy detached work.

## Tests

- Tests describe behavior rather than asserting that an implementation is "correct."
- Product-visible plugins require a real assembled composition test in addition to unit tests.
- Model-visible and user-visible behavior uses keyless snapshots through runnable examples.
- Lifecycle changes cover startup failure, cancellation, disposal, repeated registration, and process-tree cleanup where applicable.
- Keep fixtures portable across Windows, macOS, and Linux unless the behavior is intentionally platform-specific.

## Documentation

- `docs/` contains tutorials: prerequisites, ordered actions, observable outcomes, and focused warnings.
- `AgentGuide/` contains repository-wide agent and maintainer reference.
- Package READMEs own package configuration, semantics, failures, limitations, extension points, and model effects.
- State the current mechanism. Keep decision history out of tutorials and source comments.
- Use relative Markdown links and keep one factual owner for each explanation.
