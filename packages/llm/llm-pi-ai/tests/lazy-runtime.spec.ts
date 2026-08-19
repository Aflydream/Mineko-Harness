import { describe, expect, it, vi } from 'vitest'

const sdkLoaded = vi.hoisted(() => vi.fn())

vi.mock('@earendil-works/pi-ai', async (importOriginal) => {
  sdkLoaded()
  return importOriginal<typeof import('@earendil-works/pi-ai')>()
})

import { PiAiAdapter } from '../src/adapter.ts'
import { resolveProfiles } from '../src/config.ts'

describe('pi-ai execution loading', () => {
  it('keeps provider metadata and model listing on the startup-safe control plane', async () => {
    const profiles = resolveProfiles({
      'local-gateway': {
        api: 'openai-completions',
        baseURL: 'https://local.test/v1',
        models: [{ id: 'local-model' }],
      },
    })
    const adapter = new PiAiAdapter({
      profiles: () => profiles,
      resolveApiKey: () => Promise.resolve(undefined),
    })

    expect(adapter.providerInfo('local-gateway')).toEqual({ id: 'local-gateway', name: 'local-gateway' })
    await expect(adapter.listModels('local-gateway')).resolves.toEqual([{
      provider: 'local-gateway',
      id: 'local-model',
      name: 'local-model',
      inputModalities: ['text'],
    }])
    expect(sdkLoaded).not.toHaveBeenCalled()

    await adapter.resolveModel('local-gateway', 'local-model')
    expect(sdkLoaded).toHaveBeenCalledOnce()
  })
})
