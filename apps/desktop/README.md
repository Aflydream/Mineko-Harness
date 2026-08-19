# `@aflydream/mnh-desktop`

English | [中文](README.zh.md)

The Windows desktop application boots the shipped `desktop` profile in an Electron runtime and reuses the complete built Web client without starting the Web server. `pnpm run desktop` and the packaged installer use the same main process, preload, renderer, profile, and plugin roster. Both paths forward repeatable `--patch` overlays and application arguments.

## Runtime

The main process registers `mnh://` before Electron becomes ready and boots the Cordis profile tree concurrently with Electron initialization. Once Electron is ready it creates one hidden renderer so Chromium process startup overlaps the remaining Host boot; navigation to `mnh://app/` starts only after the Host tree settles, and the window remains hidden until that page finishes loading. `mnh://app/*` serves `apps/web/dist`; the shared boot graph's `/plugins/<id>/client.js` URLs resolve under `mnh://app/` and are routed to the client bundles registered by the host tree. The explicit `mnh://plugins/<id>/client.js` form reaches the same registry. The index response receives the boot manifest and boot-theme script before loading.

Electron's `userData` root is `$MNH_HOME/desktop`. Chromium local storage and caches therefore follow the selected Harness home instead of sharing Electron's generic default profile with unrelated launches.

API requests and event streams cross one `MessagePort` transferred at renderer DOM readiness, allowing Host baselines to overlap the remaining client-plugin activation. The preload exposes only `mnhDesktop.connect()` and returns a function-only channel; `contextIsolation` and the renderer sandbox stay enabled, and Node integration stays disabled. The desktop process opens no HTTP, WebSocket, or other TCP listener.

The Electron runtime cannot expose Node's internal ESM loader. App boot therefore resolves bare Cordis plugin packages through its public Node fallback, anchored directly at the packaged application manifest so Windows never has to follow a filesystem junction into ASAR. Module HMR and live profile-patch watching are disabled: `cordis.patch.yml` and `--patch` are applied at startup, and later edits take effect after restarting the desktop application.

## Development

Build package, desktop, and Web artifacts from the repository root with `pnpm run build`. `pnpm run test:desktop:built` launches the Electron carrier under a temporary `MNH_HOME`, fetches an advertised client bundle through `mnh://`, and completes `host.describe` through the preload MessagePort.

`pnpm run desktop` enters the ordinary source `mnh desktop` command. The launcher resolves the repository's Electron executable and built `apps/desktop/lib/main.js`, removes `ELECTRON_RUN_AS_NODE`, and starts the full desktop application. The development window uses the product AppUserModelId, a borderless transparent multi-resolution icon, a hidden title bar, and an auto-hidden application menu. A second launch restores and focuses the existing window.

The `build:native` script retains the isolated Tauri/WebView2 prototype under `apps/desktop/native`; no root or package start command selects it.

After the root build passes, `pnpm --filter @aflydream/mnh-desktop run package:win` is the single Windows packaging entry. It deploys the CLI-owned profile boot and its production dependency closure into an isolated staging directory with workspace injection and dependency scripts disabled, rejects every link that resolves outside that directory, loads the staged app-boot module graph, validates the desktop preload, Web assets, and node-pty Windows prebuilds, then creates `release/MiNeko-Herness-Setup-<version>.exe`. The NSIS installer is an assisted, per-user installation with a selectable directory plus Desktop and Start Menu shortcuts. Application files use ASAR, while the complete node-pty package is unpacked so its `.node`, ConPTY, and WinPTY helpers remain executable.

electron-builder reads `CSC_LINK` and `CSC_KEY_PASSWORD` when the release environment provides a Windows code-signing certificate. Without those variables it intentionally produces an unsigned installer, which Windows may show through SmartScreen.

## Known limitations

- Windows is the supported desktop platform.
- Unsigned local builds can trigger a Windows SmartScreen warning.
- Electron includes Chromium, so its baseline memory footprint is higher than the isolated WebView2 prototype.
