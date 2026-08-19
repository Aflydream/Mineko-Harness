# Contributing

English | [中文](CONTRIBUTING.zh.md)

MiNeko Herness welcomes external Issues and pull requests. The project is a Windows-only desktop project; macOS and Linux desktop releases are not planned.

## Project scope

Contributions should improve the Windows desktop application, its Electron and Node.js runtime, its shared harness packages, its documentation, or its Windows release process. Do not add a macOS or Linux desktop target unless the project scope is explicitly changed first.

## Open an Issue

Use the [Issue templates](https://github.com/Aflydream/Mineko-Harness/issues/new/choose) for bugs, feature requests, research, and tasks.

- Search existing Issues first and avoid duplicates.
- Describe the observed result, expected result, environment, and a reproducible path when reporting a bug.
- Keep credentials, tokens, private logs, and personal data out of the Issue.

## Open a Pull Request

- Fork the repository and create a focused branch from `main`.
- Open a Draft PR early when feedback would help, then mark it ready when the change is complete.
- Reference at least one same-repository Issue in the PR body. Use `Fixes #NN` when the PR should close it, or `Related to #NN` when it only provides context.
- Explain the user-visible change and include the narrowest relevant verification. For desktop changes, run `pnpm run build` and the focused desktop check when available.
- Do not commit credentials, runtime sessions, generated local state, or unrelated formatting changes.

## Review expectations

Maintainers review correctness, Windows compatibility, performance, security boundaries, durable-session behavior, and documentation impact. CI is evidence, not a substitute for review. A maintainer may request a smaller scope, additional tests, or a documentation update before merging.

## Community contributions

Plugins, tutorials, bug reports, design ideas, and performance measurements are welcome. If a proposal needs a broader platform or architecture decision, describe the problem and the trade-offs in an Issue before implementing it.

MiNeko Herness is distributed under the [MIT License](LICENSE). Third-party packages, vendored sources, and license notices are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
