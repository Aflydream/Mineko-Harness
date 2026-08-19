import { mkdtempSync, rmSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { _electron as electron, type ElectronApplication } from 'playwright'

const WORKSPACE = resolve(import.meta.dirname, '../../..')
const MAIN = resolve(WORKSPACE, 'apps/desktop/lib/main.js')
const PROFILE_BOOT_URL = pathToFileURL(resolve(WORKSPACE, 'apps/cli/lib/profile-boot.js')).href
const ELECTRON = createRequire(import.meta.url)('electron') as string
const execFileAsync = promisify(execFile)

let running: ElectronApplication | undefined
let home: string | undefined

afterEach(async () => {
  await running?.close()
  running = undefined
  if (home !== undefined) rmSync(home, { recursive: true, force: true })
  home = undefined
})

describe.skipIf(process.platform !== 'win32')('desktop built smoke', () => {
  it('loads the shared client and completes host.describe over MessagePort', async () => {
    home = mkdtempSync(resolve(tmpdir(), 'mnh-desktop-e2e-'))
    const env: Record<string, string> = {
      ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
      MNH_HOME: home,
      MNH_DESKTOP_PROFILE_BOOT_URL: PROFILE_BOOT_URL,
      MNH_TELEMETRY_DISABLED: '1',
    }
    delete env.ELECTRON_RUN_AS_NODE
    running = await electron.launch({ executablePath: ELECTRON, args: [MAIN], env })
    expect(await running.evaluate(({ app }) => app.getPath('userData'))).toBe(resolve(home, 'desktop'))
    expect(await running.evaluate(({ app }) => app.getName())).toBe('MiNeko Herness')
    const page = await running.firstWindow()
    await page.waitForURL('mnh://app/')
    await page.waitForLoadState('domcontentloaded')

    const pluginResponse = await page.evaluate(async () => {
      const graph = (globalThis as unknown as {
        __MNH_BOOT__?: { entries?: Array<{ id?: string; url?: string }> }
      }).__MNH_BOOT__
      const url = graph?.entries?.find(entry =>
        entry.id === '@aflydream/mnh-client-ui-theme' && typeof entry.url === 'string')?.url
      if (url === undefined) return { url: '', status: 0, cacheControl: '', body: '' }
      const response = await fetch(url)
      return {
        url,
        status: response.status,
        cacheControl: response.headers.get('cache-control') ?? '',
        body: (await response.text()).slice(0, 80),
      }
    })
    expect(pluginResponse.status, `${pluginResponse.url}: ${pluginResponse.body}`).toBe(200)
    expect(pluginResponse.url).toMatch(/[?&]rev=[0-9a-f]{12}(?:&|$)/)
    expect(pluginResponse.cacheControl).toBe('public, max-age=31536000, immutable')
    expect(pluginResponse.body).toContain('window.__ModuleLoader__.load')
    await page.locator('[data-conversation-scroll]').waitFor({ state: 'visible' })

    const logoResponse = await page.evaluate(async () => {
      const response = await fetch('/logo.png')
      return { status: response.status, contentType: response.headers.get('content-type') }
    })
    expect(logoResponse).toEqual({ status: 200, contentType: 'image/png' })
    await page.getByRole('button', { name: /Collapse sidebar|收起侧边栏/ }).click()
    const railLogo = page.locator('button img[src="/logo.png"]')
    await railLogo.waitFor({ state: 'visible' })
    expect(await railLogo.evaluate((image) => {
      if (!(image instanceof HTMLImageElement)) throw new Error('sidebar logo is not an image')
      return {
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      }
    })).toEqual({ complete: true, naturalWidth: 1024, naturalHeight: 1024 })

    const response = await page.evaluate(async () => {
      interface DesktopChannel {
        send(message: unknown): void
        onMessage(listener: (message: Record<string, unknown>) => void): () => void
      }
      const bridge = (globalThis as unknown as { mnhDesktop: { connect(): Promise<DesktopChannel> } }).mnhDesktop
      const channel = await bridge.connect()
      const requestId = `smoke-${crypto.randomUUID()}`
      const body = new TextEncoder().encode(JSON.stringify({
        type: 'client-request', rpcId: requestId, method: 'host.describe', payload: {},
      }))
      return new Promise<{ status: number | undefined; body: string }>((resolveResponse, reject) => {
        const chunks: Uint8Array[] = []
        let status: number | undefined
        const dispose = channel.onMessage((message) => {
          if (message.requestId !== requestId) return
          if (message.type === 'response-start') status = message.status as number
          if (message.type === 'response-chunk') chunks.push(message.chunk as Uint8Array)
          if (message.type === 'response-error') {
            dispose()
            reject(new Error(String(message.message)))
          }
          if (message.type !== 'response-end') return
          dispose()
          const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
          const bytes = new Uint8Array(length)
          let offset = 0
          for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
          }
          resolveResponse({ status, body: new TextDecoder().decode(bytes) })
        })
        channel.send({
          type: 'fetch', requestId, url: 'mnh://app/api/host.describe', method: 'POST',
          headers: [['content-type', 'application/json']], body,
        })
      })
    })

    expect(page.url()).toBe('mnh://app/')
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({ result: { ok: true } })

    await running.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0]?.minimize() })
    expect(await running.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized())).toBe(true)
    await execFileAsync(ELECTRON, [MAIN], { env, timeout: 5_000, windowsHide: true })
    await expect.poll(
      () => running?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized()),
      { timeout: 2_000 },
    ).toBe(false)
    expect(await page.evaluate(() => document.querySelector('[data-conversation-scroll]') !== null)).toBe(true)
  }, 30_000)
})
