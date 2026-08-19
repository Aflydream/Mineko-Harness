/** Electron main process for the single-instance desktop carrier and Cordis host tree. */

import { app, BrowserWindow, MessageChannelMain, protocol } from 'electron'
import { mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspect } from 'node:util'
import { loadLayeredEnv } from '@aflydream/mnh-app-boot'
import { injectBootManifest, type WebBootGraph } from '@aflydream/mnh-client-modules'
import { injectBootTheme } from '@aflydream/mnh-client-ui-theme'
import { mnhHomePath } from '@aflydream/mnh-home-paths'
import type { DesktopBridgeService } from '@aflydream/mnh-host-desktop-bridge'
import type { ClientModuleRegistry } from '@aflydream/mnh-client-modules'
import type { Context } from '@deepseek-ai/cordis'
import {
  applyDesktopTaskbarIdentity,
  DESKTOP_APP_NAME,
  DESKTOP_APP_USER_MODEL_ID,
} from './identity.js'

protocol.registerSchemesAsPrivileged([{
  scheme: 'mnh',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true },
}])

const USER_DATA_ROOT = mnhHomePath('desktop')
mkdirSync(USER_DATA_ROOT, { recursive: true })
app.setPath('userData', USER_DATA_ROOT)
app.setName(DESKTOP_APP_NAME)
app.setAppUserModelId(DESKTOP_APP_USER_MODEL_ID)

let desktopWindow: BrowserWindow | undefined
let activateWhenVisible = false

function activateDesktopWindow(): void {
  const window = desktopWindow
  if (window === undefined) {
    activateWhenVisible = true
    return
  }
  if (window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  if (!window.isVisible()) {
    activateWhenVisible = true
    return
  }
  activateWhenVisible = false
  window.show()
  window.focus()
}

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PRELOAD = join(APP_ROOT, 'lib/preload.cjs')
const APP_ICON = app.isPackaged
  ? join(process.resourcesPath, 'mineko.ico')
  : join(APP_ROOT, 'assets/mineko.ico')

function launcherArgs(): { patchFiles: string[]; args: string[] } {
  const argv = process.argv.slice(1)
  const patchFiles: string[] = []
  const args: string[] = []
  let inner = false
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--') { inner = true; continue }
    if (!inner && value === '--mnh-patch') {
      const patch = argv[index + 1]
      if (patch !== undefined) patchFiles.push(patch)
      index += 1
      continue
    }
    if (inner && value !== undefined) args.push(value)
  }
  return { patchFiles, args }
}

function registerResources(ctx: Context): void {
  const modules: ClientModuleRegistry | undefined = ctx.get('clientModules')
  if (modules === undefined) throw new Error('desktop: clientModules service missing')
  const require = createRequire(import.meta.url)
  const indexPath = require.resolve('@aflydream/mnh-web-frontend/dist/index.html')
  const distRoot = resolve(indexPath, '..')
  const handler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405 })
    // The shared boot graph uses same-origin `/plugins/...` URLs. In the
    // desktop page those resolve to `mnh://app/plugins/...`; keep accepting
    // the explicit `mnh://plugins/...` form for direct diagnostics too.
    if (url.hostname === 'plugins' || (url.hostname === 'app' && url.pathname.startsWith('/plugins/'))) {
      return pluginResource(url, modules)
    }
    if (url.hostname !== 'app') return new Response('not found', { status: 404 })
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const candidate = normalize(join(distRoot, relative))
    if (candidate !== distRoot && !candidate.startsWith(`${distRoot}${sep}`)) {
      return new Response('forbidden', { status: 403 })
    }
    try {
      let body = await readFile(candidate)
      if (candidate === indexPath) {
        const graph: WebBootGraph = modules.graph()
        let html = injectBootManifest(body.toString('utf8'), graph)
        html = injectBootTheme(html)
        body = Buffer.from(html)
      }
      const response = new Response(request.method === 'HEAD' ? null : new Blob([Uint8Array.from(body)]), {
        status: 200,
        headers: { 'content-type': mimeType(extname(candidate)), 'cache-control': candidate === indexPath ? 'no-cache' : 'public, max-age=31536000, immutable' },
      })
      return response
    } catch {
      if (candidate !== indexPath) return new Response('not found', { status: 404 })
      return new Response('not found', { status: 404 })
    }
  }
  protocol.handle('mnh', handler)
}

async function pluginResource(url: URL, modules: ClientModuleRegistry): Promise<Response> {
  const pathname = decodeURIComponent(url.pathname)
  const prefix = url.hostname === 'plugins' ? '/' : '/plugins/'
  const map = pathname.endsWith('/client.js.map')
  const suffix = map ? '/client.js.map' : '/client.js'
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return new Response('not found', { status: 404 })
  const id = pathname.slice(prefix.length, -suffix.length)
  const body = await modules.readBundle(id, map)
  if (body === undefined) return new Response('not found', { status: 404 })
  return new Response(new Blob([Uint8Array.from(body)]), { headers: { 'content-type': map ? 'application/json; charset=utf-8' : 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' } })
}

function mimeType(extension: string): string {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' } as Record<string, string>)[extension] ?? 'application/octet-stream'
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    icon: APP_ICON,
    backgroundColor: '#101216',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#656a72',
      height: 40,
    },
    backgroundMaterial: 'mica',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  applyDesktopTaskbarIdentity(window, APP_ICON)
  return window
}

async function loadWindow(window: BrowserWindow, ctx: Context): Promise<void> {
  const channel = new MessageChannelMain()
  const bridge: DesktopBridgeService | undefined = ctx.get('desktopBridge')
  if (bridge === undefined) throw new Error('desktop: desktopBridge service missing')
  const detach = bridge.attach(channel.port1)
  window.once('closed', detach)
  window.webContents.once('dom-ready', () => {
    window.webContents.postMessage('mnh-port', undefined, [channel.port2])
  })
  try {
    await window.loadURL('mnh://app/')
    window.show()
  } catch (error) {
    detach()
    window.destroy()
    throw error
  }
}

async function bootHost(): Promise<{ ctx: Context; shutdown: { shutdown(code: number): Promise<void> } }> {
  const { patchFiles, args } = launcherArgs()
  const profileBootUrl = process.env.MNH_DESKTOP_PROFILE_BOOT_URL
    ?? new URL('../../cli/lib/profile-boot.js', import.meta.url).href
  const profileBoot = await import(profileBootUrl) as {
    runProfile(options: {
      environment: ReturnType<typeof loadLayeredEnv>
      profile: string
      patchFiles: readonly string[]
      args: readonly string[]
      watchUserPatches: boolean
      moduleBaseUrl?: string
    }): Promise<{ ctx: Context; shutdown: { shutdown(code: number): Promise<void> } }>
  }
  return profileBoot.runProfile({
    environment: loadLayeredEnv('mnh'),
    profile: 'desktop',
    patchFiles,
    args,
    watchUserPatches: false,
    ...(app.isPackaged && process.env.MNH_DESKTOP_SOURCE_RUNTIME !== '1'
      ? { moduleBaseUrl: pathToFileURL(join(app.getAppPath(), 'package.json')).href }
      : {}),
  })
}

async function main(): Promise<void> {
  const booting = bootHost().then(
    host => ({ ok: true as const, host }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  await app.whenReady()
  const window = createWindow()
  desktopWindow = window
  window.once('closed', () => {
    if (desktopWindow === window) desktopWindow = undefined
  })
  const result = await booting
  if (!result.ok) {
    window.destroy()
    throw result.error
  }
  const { ctx, shutdown } = result.host
  registerResources(ctx)
  await loadWindow(window, ctx)
  if (activateWhenVisible) activateDesktopWindow()
  let shutdownComplete = false
  let pendingShutdown: Promise<void> | undefined
  app.on('before-quit', event => {
    if (shutdownComplete) return
    event.preventDefault()
    pendingShutdown ??= shutdown.shutdown(0).then(() => {
      shutdownComplete = true
      app.quit()
    })
  })
  app.on('window-all-closed', () => { app.quit() })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', activateDesktopWindow)
  void main().catch((error: unknown) => {
    console.error(inspect(error, { depth: null }))
    app.exit(1)
  })
}
