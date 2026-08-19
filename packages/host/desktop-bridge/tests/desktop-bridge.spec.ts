import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { DesktopBridgeService, type DesktopPort } from '../src/index.ts'

class TestPort implements DesktopPort {
  readonly posted: unknown[] = []
  readonly listeners = new Map<'message' | 'close', Set<(event: { data?: unknown }) => void>>()
  closed = false

  on(event: 'message' | 'close', listener: (event: { data?: unknown }) => void): this {
    const listeners = this.listeners.get(event) ?? new Set()
    listeners.add(listener)
    this.listeners.set(event, listeners)
    return this
  }

  off(event: 'message' | 'close', listener: (event: { data?: unknown }) => void): this {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  start(): void {}
  close(): void { this.closed = true }
  postMessage(message: unknown): void { this.posted.push(message) }

  emit(message: unknown): void {
    for (const listener of this.listeners.get('message') ?? []) listener({ data: message })
  }
}

async function until(predicate: () => boolean): Promise<void> {
  await vi.waitFor(() => { expect(predicate()).toBe(true) })
}

describe('desktop bridge', () => {
  it('selects the longest route and streams response chunks in order', async () => {
    const bridge = new DesktopBridgeService(new Context())
    bridge.register({ path: '/api', fetch: async () => new Response('wrong') })
    bridge.register({
      path: '/api/events',
      fetch: async request => new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          expect(request.method).toBe('POST')
          expect(request.headers.get('x-test')).toBe('yes')
          controller.enqueue(new TextEncoder().encode('one'))
          controller.enqueue(new TextEncoder().encode('two'))
          controller.close()
        },
      }), { status: 201, headers: { 'x-result': 'ok' } }),
    })
    const port = new TestPort()
    bridge.attach(port)
    port.emit({
      type: 'fetch', requestId: 'request-1', url: 'mnh://app/api/events/mux', method: 'POST',
      headers: [['x-test', 'yes']], body: new TextEncoder().encode('{}'),
    })
    await until(() => port.posted.some(message => (message as { type?: string }).type === 'response-end'))
    expect(port.posted.map(message => (message as { type: string }).type)).toEqual([
      'response-start', 'response-chunk', 'response-chunk', 'response-end',
    ])
    expect(port.posted[0]).toMatchObject({ requestId: 'request-1', status: 201 })
    expect(new TextDecoder().decode((port.posted[1] as { chunk: Uint8Array }).chunk)).toBe('one')
    expect(new TextDecoder().decode((port.posted[2] as { chunk: Uint8Array }).chunk)).toBe('two')
  })

  it('propagates renderer cancellation and ignores malformed messages', async () => {
    const bridge = new DesktopBridgeService(new Context())
    let observedSignal: AbortSignal | undefined
    bridge.register({
      path: '/api',
      fetch: request => new Promise<Response>((_resolve, reject) => {
        observedSignal = request.signal
        request.signal.addEventListener('abort', () => {
          reject(request.signal.reason instanceof Error ? request.signal.reason : new Error('aborted'))
        }, { once: true })
      }),
    })
    const port = new TestPort()
    const detach = bridge.attach(port)
    port.emit({ type: 'fetch', requestId: 'request-2', url: 'mnh://app/api/wait' })
    await until(() => observedSignal !== undefined)
    port.emit({ type: 'abort', requestId: 'request-2' })
    await until(() => port.posted.length === 1)
    expect(observedSignal?.aborted).toBe(true)
    expect(port.posted[0]).toMatchObject({ type: 'response-error', requestId: 'request-2' })
    port.emit({ type: 'fetch', requestId: '', url: 42 })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(port.posted).toHaveLength(1)
    detach()
    expect(port.closed).toBe(true)
  })

  it('rejects invalid and duplicate route prefixes', () => {
    const bridge = new DesktopBridgeService(new Context())
    expect(() => bridge.register({ path: 'api', fetch: async () => new Response() })).toThrow('absolute prefix')
    expect(() => bridge.register({ path: '/api/', fetch: async () => new Response() })).toThrow('absolute prefix')
    bridge.register({ path: '/api', fetch: async () => new Response() })
    expect(() => bridge.register({ path: '/api', fetch: async () => new Response() })).toThrow('duplicate route')
  })
})
