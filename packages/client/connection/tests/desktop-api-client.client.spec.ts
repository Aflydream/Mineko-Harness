import { describe, expect, it, vi } from 'vitest'
import { DesktopApiClient, type DesktopChannel } from '../src/client/desktop-api-client.ts'

class TestChannel implements DesktopChannel {
  readonly sent: unknown[] = []
  private readonly listeners = new Set<(message: unknown) => void>()

  send(message: unknown): void { this.sent.push(message) }
  onMessage(listener: (message: unknown) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  emit(message: unknown): void {
    for (const listener of this.listeners) listener(message)
  }
}

async function sentRequest(channel: TestChannel): Promise<{ requestId: string }> {
  await vi.waitFor(() => { expect(channel.sent).toHaveLength(1) })
  return channel.sent[0] as { requestId: string }
}

describe('DesktopApiClient', () => {
  it('assembles a streamed response and preserves Request inputs', async () => {
    const channel = new TestChannel()
    const client = new DesktopApiClient(Promise.resolve(channel))
    const responsePromise = client.fetch(new Request('mnh://app/api/test', {
      method: 'POST', headers: { 'x-test': 'yes' }, body: 'payload',
    }))
    const { requestId } = await sentRequest(channel)
    expect(channel.sent[0]).toMatchObject({
      type: 'fetch', requestId, url: 'mnh://app/api/test', method: 'POST',
    })
    expect((channel.sent[0] as { headers: [string, string][] }).headers)
      .toContainEqual(['x-test', 'yes'])
    expect(new TextDecoder().decode((channel.sent[0] as { body: Uint8Array }).body)).toBe('payload')
    channel.emit({ type: 'response-start', requestId, status: 200, statusText: 'OK', headers: [['x-result', 'yes']] })
    channel.emit({ type: 'response-chunk', requestId, chunk: new TextEncoder().encode('hello ') })
    channel.emit({ type: 'response-chunk', requestId, chunk: new TextEncoder().encode('desktop') })
    channel.emit({ type: 'response-end', requestId })
    const response = await responsePromise
    expect(response.headers.get('x-result')).toBe('yes')
    await expect(response.text()).resolves.toBe('hello desktop')
  })

  it('rejects channel setup failure and malformed response order', async () => {
    const unavailable = new DesktopApiClient(Promise.reject(new Error('no port')))
    await expect(unavailable.fetch(new URL('mnh://app/api/test'))).rejects.toThrow('no port')

    const channel = new TestChannel()
    const client = new DesktopApiClient(Promise.resolve(channel))
    const response = client.fetch(new URL('mnh://app/api/test'))
    const { requestId } = await sentRequest(channel)
    channel.emit({ type: 'response-end', requestId })
    await expect(response).rejects.toThrow('ended before response headers')
  })

  it('forwards AbortSignal cancellation to the host', async () => {
    const channel = new TestChannel()
    const client = new DesktopApiClient(Promise.resolve(channel))
    const controller = new AbortController()
    const response = client.fetch(new URL('mnh://app/api/wait'), { signal: controller.signal })
    const { requestId } = await sentRequest(channel)
    controller.abort(new Error('cancelled'))
    await expect(response).rejects.toThrow('cancelled')
    await vi.waitFor(() => {
      expect(channel.sent).toContainEqual({ type: 'abort', requestId })
    })
  })
})
