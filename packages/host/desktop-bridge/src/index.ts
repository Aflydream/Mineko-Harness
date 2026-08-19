/**
 * Electron carrier for the host fetch contract. The main process owns this
 * service and attaches one transferred MessagePort; the renderer sees only a
 * fetch-shaped request/response stream and never receives Node capabilities.
 */

import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Socket-free fetch carrier owned by the Electron main process. */
    desktopBridge: DesktopBridgeService
  }
}

/** MessagePort subset shared by Electron's MessagePortMain and test doubles. */
export interface DesktopPort {
  on(event: 'message' | 'close', listener: (event: { data?: unknown }) => void): this
  off?(event: 'message' | 'close', listener: (event: { data?: unknown }) => void): this
  start(): void
  close(): void
  postMessage(message: unknown): void
}

/** Request sent by the renderer-side DesktopApiClient. */
export interface DesktopFetchRequest {
  type: 'fetch'
  requestId: string
  url: string
  method?: string
  headers?: [string, string][]
  body?: Uint8Array
}

/** Cancellation sent when a renderer AbortSignal fires. */
export interface DesktopFetchAbort {
  type: 'abort'
  requestId: string
}

type DesktopMessage = DesktopFetchRequest | DesktopFetchAbort

/** Route registered by the carrier-neutral Connection service. */
export interface DesktopFetchRoute {
  /** Absolute pathname prefix, for example `/api`. */
  path: string
  /** Handles requests whose pathname equals or starts with the prefix. */
  fetch(request: Request): Promise<Response>
}

interface ResponseStart {
  type: 'response-start'
  requestId: string
  status: number
  statusText: string
  headers: [string, string][]
}

interface ResponseChunk {
  type: 'response-chunk'
  requestId: string
  chunk: Uint8Array
}

interface ResponseEnd {
  type: 'response-end'
  requestId: string
}

interface ResponseError {
  type: 'response-error'
  requestId: string
  message: string
}

/** Host service that dispatches renderer fetches without opening a socket. */
export class DesktopBridgeService extends Service {
  static inject: string[] = []

  private readonly routes = new Map<string, DesktopFetchRoute>()
  private readonly ports = new Set<DesktopPort>()
  private readonly aborters = new Map<string, AbortController>()

  constructor(ctx: Context) {
    super(ctx, 'desktopBridge')
  }

  /**
   * Register one pathname prefix.
   * @param route - Prefix and fetch handler owned by the caller's fiber.
   * @returns a disposer that removes the route.
   */
  register(route: DesktopFetchRoute): () => void {
    if (!route.path.startsWith('/') || route.path.endsWith('/')) {
      throw new Error(`desktop-bridge: route path must be an absolute prefix without a trailing slash, got ${JSON.stringify(route.path)}`)
    }
    if (this.routes.has(route.path)) throw new Error(`desktop-bridge: duplicate route ${JSON.stringify(route.path)}`)
    this.routes.set(route.path, route)
    return () => { this.routes.delete(route.path) }
  }

  /**
   * Attach one renderer MessagePort.
   * @param port - Main-process end of the renderer's transferred channel.
   * @returns a disposer that detaches listeners, aborts requests, and closes the port.
   */
  attach(port: DesktopPort): () => void {
    const onMessage = (event: { data?: unknown }): void => {
      void this.handleMessage(port, event.data)
    }
    const onClose = (): void => { this.detach(port, onMessage, onClose) }
    port.on('message', onMessage).on('close', onClose)
    port.start()
    this.ports.add(port)
    return () => { this.detach(port, onMessage, onClose) }
  }

  private detach(port: DesktopPort, onMessage: (event: { data?: unknown }) => void, onClose: (event: { data?: unknown }) => void): void {
    if (!this.ports.delete(port)) return
    port.off?.('message', onMessage)
    port.off?.('close', onClose)
    port.close()
    for (const controller of this.aborters.values()) controller.abort()
    this.aborters.clear()
  }

  private async handleMessage(port: DesktopPort, raw: unknown): Promise<void> {
    if (!isDesktopMessage(raw)) return
    if (raw.type === 'abort') {
      this.aborters.get(raw.requestId)?.abort()
      return
    }
    const controller = new AbortController()
    this.aborters.set(raw.requestId, controller)
    try {
      const request = new Request(raw.url, {
        method: raw.method ?? 'GET',
        headers: raw.headers ?? [],
        ...(raw.body === undefined ? {} : { body: new Blob([Uint8Array.from(raw.body)]) }),
        signal: controller.signal,
      })
      const pathname = new URL(raw.url).pathname
      const route = this.match(pathname)
      const response = route === undefined
        ? new Response('not found', { status: 404 })
        : await route.fetch(request)
      port.postMessage({
        type: 'response-start', requestId: raw.requestId, status: response.status,
        statusText: response.statusText, headers: [...response.headers.entries()],
      } satisfies ResponseStart)
      if (response.body !== null) {
        const reader = response.body.getReader()
        while (true) {
          const next = await reader.read()
          if (next.done) break
          port.postMessage({ type: 'response-chunk', requestId: raw.requestId, chunk: next.value } satisfies ResponseChunk)
        }
      }
      port.postMessage({ type: 'response-end', requestId: raw.requestId } satisfies ResponseEnd)
    } catch (error) {
      port.postMessage({ type: 'response-error', requestId: raw.requestId, message: String(error) } satisfies ResponseError)
    } finally {
      this.aborters.delete(raw.requestId)
    }
  }

  private match(pathname: string): DesktopFetchRoute | undefined {
    let selected: DesktopFetchRoute | undefined
    for (const route of this.routes.values()) {
      if (pathname === route.path || pathname.startsWith(`${route.path}/`)) {
        if (selected === undefined || route.path.length > selected.path.length) selected = route
      }
    }
    return selected
  }
}

function isDesktopMessage(value: unknown): value is DesktopMessage {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.requestId !== 'string' || record.requestId.length === 0) return false
  if (record.type === 'abort') return true
  if (record.type !== 'fetch' || typeof record.url !== 'string') return false
  if (record.method !== undefined && typeof record.method !== 'string') return false
  if (record.headers !== undefined && (!Array.isArray(record.headers) || record.headers.some(entry =>
    !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || typeof entry[1] !== 'string'))) return false
  return record.body === undefined || record.body instanceof Uint8Array
}

export const name = 'desktop-bridge'

export function apply(ctx: Context): void {
  new DesktopBridgeService(ctx)
}

export default DesktopBridgeService
