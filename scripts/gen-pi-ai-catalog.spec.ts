import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  collectPiAiCatalog,
  loadPiAiCatalogSource,
  PI_AI_CATALOG_OUTPUT,
  renderPiAiCatalog,
  type PiAiCatalogSource,
} from './gen-pi-ai-catalog.ts'

const root = resolve(import.meta.dirname, '..')

function source(overrides: Partial<PiAiCatalogSource> = {}): PiAiCatalogSource {
  const provider = { id: 'alpha', name: 'Alpha', auth: { apiKey: {} } }
  const model = { id: 'alpha-model', name: 'Alpha model', provider: 'alpha', api: 'openai-completions' }
  return {
    builtinProviders: () => [provider],
    getBuiltinProviders: () => ['alpha'],
    getBuiltinModels: () => [model],
    ...overrides,
  }
}

describe('pi-ai catalog generator', () => {
  it('renders deterministic ASCII source with one trailing newline', () => {
    const catalog = collectPiAiCatalog(source())
    const rendered = renderPiAiCatalog(catalog)
    expect(rendered).toBe(renderPiAiCatalog(collectPiAiCatalog(source())))
    expect(rendered.endsWith('\n')).toBe(true)
    expect(rendered.endsWith('\n\n')).toBe(false)
    expect(rendered).not.toMatch(/[\u0080-\uffff]/u)
  })

  it('rejects duplicate providers, duplicate models, and non-JSON values', () => {
    expect(() => collectPiAiCatalog(source({
      builtinProviders: () => [
        { id: 'alpha', name: 'Alpha', auth: {} },
        { id: 'alpha', name: 'Duplicate', auth: {} },
      ],
    }))).toThrow(/duplicate runtime provider id/)

    expect(() => collectPiAiCatalog(source({
      getBuiltinModels: () => [
        { id: 'alpha-model', provider: 'alpha' },
        { id: 'alpha-model', provider: 'alpha' },
      ],
    }))).toThrow(/duplicate model id/)

    expect(() => collectPiAiCatalog(source({
      getBuiltinModels: () => [{ id: 'bad', provider: 'alpha', value: undefined }],
    }))).toThrow(/non-JSON undefined/)
  })

  it('keeps the static catalog and runtime-provider sets distinct', async () => {
    const actual = collectPiAiCatalog(await loadPiAiCatalogSource())
    expect(actual.providers).toHaveLength(38)
    expect(actual.catalogProviderIds).toHaveLength(37)
    expect(actual.providers.map(provider => provider.id)).toContain('radius')
    expect(actual.catalogProviderIds).not.toContain('radius')
    expect(Object.values(actual.models).flat()).toHaveLength(1109)
  })

  it('matches the committed generated source', async () => {
    const actual = collectPiAiCatalog(await loadPiAiCatalogSource())
    const generated = renderPiAiCatalog(actual)
    expect(readFileSync(resolve(root, PI_AI_CATALOG_OUTPUT), 'utf8')).toBe(generated)
  })
})
