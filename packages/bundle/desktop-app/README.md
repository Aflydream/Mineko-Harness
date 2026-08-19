# mnh-desktop-app

English | [中文](README.zh.md)

The desktop bundle keeps the Web client roster and replaces the loopback HTTP carrier with `mnh-host-desktop-bridge`. Electron serves `mnh://app/*` and `mnh://plugins/*` from the same built artifacts, while API and event streams travel through one transferred MessagePort. Through the base and Web layers, the desktop installation includes `mnh-llm-pi-ai`, the Models settings page, and the per-model selection controls, so OpenAI/Codex and Anthropic/Claude API models need no desktop-specific adapter.

The layer disables the browser webserver, URL startup, and WebSocket client-HMR rows. It selects the existing browse directory-picker provider because the Web auto-selector depends on bind-host facts. It does not change session storage, RPC envelopes, or client UI packages. A missing bridge or a second physical carrier fails the connection plugin during activation.

## Model Experience

### Desktop surface composition

#### What the model sees

The desktop layer registers no model-facing content of its own. Disabling the Web runtime also omits that bundle's `harness:source` and `app:web-surface` prompt sections and the `MNH_WEB_URL` managed environment variable; the base bundle and each remaining plugin continue to own their model-visible content.

#### Token effect

None from this layer. Compared with the Web surface, the omitted Web-only sections and environment variable consume no tokens.

#### KV Cache effect

None from the carrier choice. The desktop composition is fixed for the process lifetime, so it introduces no per-turn prefix changes.

## Known Limitations and Deferred Work

- **Profile patch changes require an application restart** — Electron disables the Loader's profile-patch watcher because the desktop process cannot use the browser HMR loader path; the initial patch is still applied during boot.
- **The desktop carrier serves one renderer port at a time** — the bundle is composed for the single Electron window, and additional windows need an explicit port ownership and session policy before they can share the host tree.
