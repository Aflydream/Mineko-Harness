/** Renderer-side fetch carrier over the Electron-preload MessagePort facade. */

import { AbstractApiClient } from './api.ts'
import type { ClientConnectionRpc } from '../rpc.ts'
import type { RpcResult } from '@aflydream/mnh-host-apiproxy/api'

/** Function-only channel exposed by preload; no Electron or Node object crosses the bridge. */
export interface DesktopChannel {
  send(message: unknown): void
  onMessage(listener: (message: unknown) => void): () => void
}

/** Preload API shape installed by apps/desktop/src/preload.ts. */
export interface DesktopBridgeWindow {
  mnhDesktop?: { connect(): Promise<DesktopChannel> }
}

interface Pending {
  readonly resolve: (response: Response) => void
  readonly reject: (error: unknown) => void
  readonly controller: ReadableStreamDefaultController<Uint8Array>
  readonly stream: ReadableStream<Uint8Array>
  started: boolean
  cleanup?: () => void
}

/** API client whose fetch semantics are carried by one renderer MessagePort. */
export class DesktopApiClient extends AbstractApiClient {
  private readonly channelPromise: Promise<DesktopChannel>
  private readonly pending = new Map<string, Pending>()
  private sequence = 0

  constructor(channel?: Promise<DesktopChannel>) {
    super()
    this.channelPromise = channel ?? desktopChannel()
    void this.channelPromise.then((channelValue) => {
      channelValue.onMessage((message) => { this.receive(message) })
    }, () => undefined)
  }

  /**
   * Fetch through the same carrier used by the inherited API methods.
   * @param input - URL or Request to send through the desktop bridge.
   * @param init - optional fetch overrides.
   * @returns the response once its headers arrive; its body remains streaming.
   */
  fetch(input: URL | RequestInfo, init?: RequestInit): Promise<Response> {
    if (input instanceof Request && init === undefined) {
      return input.clone().arrayBuffer().then(body => this.doFetch(
        new URL(input.url, this.resolveBase()),
        {
          method: input.method,
          headers: input.headers,
          ...(body.byteLength === 0 ? {} : { body }),
          signal: input.signal,
        },
      ))
    }
    const url = input instanceof URL ? input : new URL(input instanceof Request ? input.url : input, this.resolveBase())
    return this.doFetch(url, init)
  }

  protected doFetch(input: URL, init?: RequestInit): Promise<Response> {
    const requestId = `desktop-${String(++this.sequence)}-${crypto.randomUUID()}`
    const signal = init?.signal ?? undefined
    if (signal?.aborted) return Promise.reject(abortError(signal.reason))
    const response = new Promise<Response>((resolve, reject) => {
      let controller!: ReadableStreamDefaultController<Uint8Array>
      const stream = new ReadableStream<Uint8Array>({
        start: (next) => { controller = next },
        cancel: () => { this.abort(requestId, new Error('Response body was cancelled')) },
      })
      this.pending.set(requestId, { resolve, reject, controller, stream, started: false })
      // `stream` is captured by the response-start handler; construction is
      // delayed until the channel is ready so every request has one owner.
      void this.send(requestId, input, init, signal)
    })
    return response
  }

  private async send(requestId: string, input: URL, init: RequestInit | undefined, signal: AbortSignal | undefined): Promise<void> {
    try {
      const channel = await this.channelPromise
      const onAbort = (): void => { this.abort(requestId, signal?.reason) }
      signal?.addEventListener('abort', onAbort, { once: true })
      const pending = this.pending.get(requestId)
      if (pending !== undefined && signal !== undefined) {
        pending.cleanup = () => { signal.removeEventListener('abort', onAbort) }
      }
      if (signal?.aborted) {
        onAbort()
        return
      }
      const headers = [...new Headers(init?.headers).entries()]
      const body = encodeBody(init?.body)
      channel.send({ type: 'fetch', requestId, url: input.href, method: init?.method, headers, body })
    } catch (error) {
      this.fail(requestId, error)
    }
  }

  private abort(requestId: string, reason: unknown): void {
    void this.channelPromise.then((channel) => { channel.send({ type: 'abort', requestId }) }).catch(() => undefined)
    const pending = this.pending.get(requestId)
    if (pending === undefined) return
    this.fail(requestId, abortError(reason))
  }

  private fail(requestId: string, error: unknown): void {
    const pending = this.pending.get(requestId)
    if (pending === undefined) return
    pending.cleanup?.()
    pending.controller.error(error)
    pending.reject(error)
    this.pending.delete(requestId)
  }

  private receive(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const message = raw as Record<string, unknown>
    const requestId = message.requestId
    if (typeof requestId !== 'string') return
    const pending = this.pending.get(requestId)
    if (pending === undefined) return
    if (message.type === 'response-start') {
      if (pending.started) return
      if (typeof message.status !== 'number' || !Number.isInteger(message.status)
        || message.status < 100 || message.status > 999) {
        this.fail(requestId, new Error('desktop bridge returned an invalid response status'))
        return
      }
      pending.started = true
      const status = message.status
      const statusText = typeof message.statusText === 'string' ? message.statusText : ''
      const headers = parseHeaders(message.headers)
      pending.resolve(new Response(pending.stream, { status, statusText, headers }))
      return
    }
    if (message.type === 'response-chunk') {
      if (!pending.started || !(message.chunk instanceof Uint8Array)) {
        this.fail(requestId, new Error('desktop bridge returned an invalid response chunk'))
        return
      }
      pending.controller.enqueue(message.chunk)
      return
    }
    if (message.type === 'response-end') {
      if (!pending.started) {
        this.fail(requestId, new Error('desktop bridge ended before response headers'))
        return
      }
      pending.cleanup?.()
      pending.controller.close()
      this.pending.delete(requestId)
      return
    }
    if (message.type === 'response-error') {
      const error = new Error(typeof message.message === 'string' ? message.message : 'desktop bridge request failed')
      pending.cleanup?.()
      pending.controller.error(error)
      pending.reject(error)
      this.pending.delete(requestId)
    }
  }
}

function encodeBody(value: BodyInit | null | undefined): Uint8Array | undefined {
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return undefined
}

function abortError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error('This operation was aborted')
}

function parseHeaders(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is [string, string] =>
    Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && typeof entry[1] === 'string')
}

function desktopChannel(): Promise<DesktopChannel> {
  const bridge = (globalThis as DesktopBridgeWindow).mnhDesktop
  if (bridge === undefined) throw new Error('desktop connection: preload did not expose mnhDesktop')
  return bridge.connect()
}

/**
 * Create generic logical RPC calls over the desktop fetch carrier.
 * @param fetcher - desktop-backed fetch implementation.
 * @returns the generic Connection RPC client.
 */
export function createDesktopConnectionRpc(fetcher: (input: URL, init?: RequestInit) => Promise<Response>): ClientConnectionRpc {
  return {
    async call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<RpcResult<unknown>> {
      const rpcId = crypto.randomUUID()
      const response = await fetcher(new URL(`${channel}/${endpoint}`, 'mnh://app/'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId, method: endpoint, payload }),
        ...(signal === undefined ? {} : { signal }),
      })
      if (!response.ok) throw new Error(`transport failure for ${channel}/${endpoint}: HTTP ${response.status}`)
      const value = await response.json() as { rpcId?: string; result?: unknown }
      if (value.rpcId !== rpcId) throw new Error(`rpcId mismatch for ${endpoint}: sent ${rpcId}, got ${String(value.rpcId)}`)
      return value.result as RpcResult<unknown>
    },
  }
}
