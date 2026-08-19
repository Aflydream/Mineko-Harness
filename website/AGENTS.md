# AGENTS.md — Documentation website adapter

Follow the [root instructions](../AGENTS.md), [documentation conventions](../AgentGuide/conventions.md), and [development checks](../AgentGuide/development.md).

## Keep documentation content out of this tree

`website/` owns only VitePress configuration, presentation assets, and the publication manifest. This file is the only maintained Markdown file in this subtree.

Keep canonical tutorials under `docs/`, then expose selected pages through [docs.ts](docs.ts). Agent and maintainer references under `AgentGuide/` are repository-local and are not projected into the public site. Never add locale, route, API, or copied documentation trees such as `website/zh-CN/`, `website/en/`, or `website/api/`.

The projector writes disposable Markdown to the ignored `website/.generated/` directory. Never edit or commit `.generated/`, `.cache/`, or `.dist/`.

Run `pnpm docs:check` after changing this subtree; the gate rejects additional non-ignored Markdown under `website/`.
