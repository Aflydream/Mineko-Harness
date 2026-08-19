# Electron Desktop

The default Windows carrier is Electron with a Node.js main process. The optional native prototype under `apps/desktop/native/` is not selected by root startup or packaging commands.

## Development startup

```text
pnpm run desktop
  -> node scripts/mnh.mjs desktop
  -> apps/cli/src/bin.ts
  -> @aflydream/mnh-desktop/launcher
  -> Electron executable
  -> apps/desktop/lib/main.js
  -> desktop Cordis profile
  -> mnh:// renderer
```

The CLI remains part of the source startup chain even though no standalone CLI service is opened. Do not remove `apps/cli/` while `scripts/mnh.mjs` dispatches desktop startup through it.

## Runtime split

| Component | Responsibility |
|---|---|
| Electron main | Window lifetime, single-instance behavior, protocol handling, Windows identity, and Host boot |
| Preload | Narrow MessagePort transfer between isolated renderer and Host |
| Node.js Host | Cordis plugins, agents, models, tools, sessions, settings, and execution |
| Renderer | Shared client modules and interface loaded from built assets |
| `mnh://` | Private asset protocol; no HTTP server or TCP listener |

## Windows identity

The product name, AppUserModelId, executable metadata, window icon, installer icon, shortcut identity, and taskbar identity must agree. Use the transparent multi-resolution `apps/desktop/assets/mineko.ico`; do not place it on a blue or opaque square background.

## Interface requirements

- The product name and logo remain visible and sharp at Windows taskbar and window-icon sizes.
- `Make Everything Happen` is the product slogan.
- Settings and comparable open/close interactions animate in both directions and unmount only after the closing animation finishes.
- The interface preserves the complete feature set while using the desktop transport.
- Reasoning controls display adapter-declared levels for the selected model.

## Performance

- Keep one long-lived transport and avoid polling when session events can push updates.
- Release window, MessagePort, listener, and session subscriptions through exact disposers.
- Virtualize long trajectories and avoid retaining duplicate rendered session state.
- Move CPU-heavy or blocking work to existing worker or subprocess providers instead of the renderer thread.
- Measure cold start, idle memory, long-session memory, and interaction latency with the real desktop profile.

## Packaging

```sh
pnpm run build
pnpm --filter @aflydream/mnh-desktop run package:win
```

Release staging must resolve all runtime dependencies inside the isolated staging tree and verify the desktop main process, preload, renderer assets, native modules, and icon before building the NSIS installer.

## Release flow

Pull requests run the repository CI, and a merge into `main` starts the same CI on the resulting commit. A Windows desktop release is deliberately separate from ordinary merges so every merge does not create a duplicate versioned release.

### Approved release from `dev`

When `dev` is ready, first commit the human-written release section to `CHANGELOG.md` on `dev`. The section must use the version you intend to publish and contain at least one `###` subsection. The root, CLI, and desktop manifests must already carry that same version in your commit. Then open **Actions → Promote dev release → Run workflow**, select the `dev` branch, and enter the version without `v`:

```text
0.1.0       stable release
0.1.0-rc.6  prerelease
```

The workflow validates the existing `dev` commit, then creates or updates a normal `dev` → `main` pull request. It does not edit files, create a bot commit, push either branch, or merge the PR. Review the PR and click GitHub's normal **Merge pull request** button yourself. The resulting push to `main` verifies the merged version, creates the matching tag, and explicitly starts the Windows release workflow. A stable version has no hyphen and becomes an ordinary GitHub Release; a version containing a hyphen is marked as a prerelease. If `main` has diverged, resolve that in `dev` before running the Action; if the tag already exists or the merged metadata does not match, no tag is created.

Use GitHub's normal merge option for this promotion PR rather than deleting or bypassing the branch flow. Ordinary pushes to `main` are ignored by the release guard; only a merged PR with the generated release title and hidden version marker can create a release tag.

### Manual tag fallback

If you intentionally publish outside the generated promotion PR, after the version and its `CHANGELOG.md` entry are merged, push one matching tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The desktop workflow accepts only `v<version>` tags, such as `v0.1.0` or `v0.1.0-rc.6`. The root, CLI, and desktop manifests must carry the same semantic version, and the changelog must contain one dated section for it. The workflow builds and smoke-tests the Windows x64 installer, verifies its checksum, and creates a GitHub Release with the changelog changes, download table, slogan, and pre-release status when applicable. Manual dispatch of the desktop workflow itself is a dry run; the `Promote dev release` workflow is the normal publishing path.
