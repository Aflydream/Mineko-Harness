# Development

## Requirements

- Node.js `^22.19.0` or `>=24.0.0`
- pnpm `11.7.0`
- Windows for the default Electron desktop workflow and Windows release checks
- API credentials only for tests or demos that explicitly use a real provider

## Setup and desktop

```sh
pnpm install
pnpm run build
pnpm run desktop
```

`pnpm run desktop` expects built library, desktop, and renderer output. Rebuild after changing package exports, generated clients, desktop main/preload code, or client bundles.

## Common checks

| Change | First checks |
|---|---|
| One package implementation | Focused Vitest file, package TypeScript build, affected invariant |
| Shared TypeScript API | Focused tests, `pnpm run typecheck`, affected consumer builds |
| Desktop main/preload/launcher | Desktop unit tests, `pnpm run build`, `pnpm run test:desktop:built` |
| Renderer behavior | Focused Web test, Web build, real desktop smoke for desktop-only transport behavior |
| Model-visible behavior | Focused unit/e2e plus a keyless assembled snapshot |
| Documentation tutorial | Markdown links, wrapping, site projection, VitePress build |
| Package manifest or exports | Build, publint, runtime closure, NodeNext consumer check |

Useful aggregate commands:

```sh
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run doc-sync
```

Select checks according to the changed behavior. The full suite is appropriate for repository-wide contracts, CI diagnosis, and final release rehearsal; it is not the default inner loop.

## AI pull-request review

The .github/workflows/ai-pr-review.yml workflow runs on non-Draft pull request creation, updates, reopening, and ready_for_review. It checks out only the trusted default branch, reads the pull request metadata and diff through the GitHub API, sends that untrusted text to the configured OpenAI Responses API model, validates the structured result against real added lines, and posts one advisory GitHub review with inline comments. It never checks out or executes the pull request branch. The review step is non-blocking, so a provider outage, rate limit, or malformed model response leaves the workflow warning without blocking a merge.

Configure the repository secret AI_REVIEW_API_KEY to enable the workflow. OPENAI_API_KEY remains accepted as a compatibility fallback. Set the repository Actions variable AI_REVIEW_API_URL to a custom endpoint when needed; it must accept the OpenAI Responses API request shape and return a compatible response. The default model is gpt-5.2-codex; repository Actions variables AI_REVIEW_MODEL and AI_REVIEW_REASONING_EFFORT can override the model and reasoning effort. The review is intentionally submitted as COMMENT, not REQUEST_CHANGES; human reviewers and branch protection remain authoritative. Pull-request code and descriptions are sent to the configured model provider, so enable this only when that data-sharing boundary is acceptable. A manual workflow dispatch can review a specific pull request number.

## Package workflow

1. Locate the owning package and read its README, `package.json`, source exports, and closest tests.
2. Follow cross-package imports by package name. Use `.ts` extensions only for local relative imports.
3. Update service definition, provider, consumer, configuration, README, and tests together when their shared behavior changes.
4. Add or update runtime invariants for owned relationships.
5. Run the focused behavior test before broader static checks.

## Generated files

Catalogs, RPC clients, graph references, and compiled `lib/` files have an owning generator or build. Change the source and rerun the owner; do not hand-edit generated regions.

## Credentials and runtime data

Keep credentials in environment variables, `.env`, or the configured credential store. Never commit keys. Runtime sessions, databases, traces, profiles, build products, and local agent state belong in ignored directories.

## Windows process work

Read [conventions.md](conventions.md) before modifying process lifecycle. Tests must prove child-tree shutdown, cancellation convergence, and cleanup on Windows. Use explicit paths and shell-free process spawning at package boundaries.
