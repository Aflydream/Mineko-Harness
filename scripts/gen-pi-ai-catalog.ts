/**
 * Generate the startup-safe pi-ai provider and model catalog snapshot.
 *
 * The generator consumes pi-ai's public `providers/all` API. Product startup
 * reads the generated constants, while the real providers and their stream
 * implementations remain deferred until the first model execution.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { findPackageJSON } from 'node:module'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')

/** Repository-relative generated catalog destination. */
export const PI_AI_CATALOG_OUTPUT = 'packages/llm/llm-pi-ai/src/catalog.generated.ts'

const PACKAGE_ANCHOR = resolve(root, 'packages/llm/llm-pi-ai/src/index.ts')

type JsonPrimitive = boolean | number | string | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
interface JsonObject { [key: string]: JsonValue }

interface PiAiProviderSource {
  readonly id: string
  readonly name: string
  readonly baseUrl?: string
  readonly auth: unknown
}

/** Public pi-ai catalog operations consumed by the generator. */
export interface PiAiCatalogSource {
  /** Construct every runtime provider, including providers with no static catalog. */
  builtinProviders(): readonly PiAiProviderSource[]
  /** Return provider ids backed by the generated static model catalog. */
  getBuiltinProviders(): readonly string[]
  /** Return the complete static models for one catalog provider. */
  getBuiltinModels(provider: string): readonly unknown[]
}

/** Serializable provider facts needed before the pi-ai runtime loads. */
export interface GeneratedPiAiProvider {
  readonly id: string
  readonly name: string
  readonly baseUrl?: string
  readonly takesApiKey: boolean
}

/** Complete generated input for the product catalog module. */
export interface GeneratedPiAiCatalog {
  readonly providers: readonly GeneratedPiAiProvider[]
  readonly catalogProviderIds: readonly string[]
  readonly models: Readonly<Record<string, readonly JsonObject[]>>
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function canonicalJson(value: unknown, path: string, active = new Set<object>()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    throw new Error(`gen-pi-ai-catalog: ${path} contains non-finite number ${String(value)}`)
  }
  if (typeof value !== 'object') {
    throw new Error(`gen-pi-ai-catalog: ${path} contains non-JSON ${typeof value}`)
  }
  if (active.has(value)) throw new Error(`gen-pi-ai-catalog: ${path} contains a cycle`)
  active.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) => canonicalJson(entry, `${path}[${String(index)}]`, active))
    }
    const prototype: unknown = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`gen-pi-ai-catalog: ${path} contains a non-plain object`)
    }
    const symbols = Object.getOwnPropertySymbols(value)
    if (symbols.length > 0) throw new Error(`gen-pi-ai-catalog: ${path} contains a symbol key`)
    const output: JsonObject = {}
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalJson((value as Record<string, unknown>)[key], `${path}.${key}`, active)
    }
    return output
  } finally {
    active.delete(value)
  }
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`gen-pi-ai-catalog: ${path} must be a non-empty string`)
  }
  return value
}

function unique(value: string, seen: Set<string>, path: string): void {
  if (seen.has(value)) throw new Error(`gen-pi-ai-catalog: duplicate ${path} ${JSON.stringify(value)}`)
  seen.add(value)
}

/**
 * Capture and validate every serializable catalog fact from pi-ai.
 * @param source - pi-ai's public providers/all operations.
 * @returns deterministic provider metadata, catalog ids, and complete models.
 */
export function collectPiAiCatalog(source: PiAiCatalogSource): GeneratedPiAiCatalog {
  const providerIds = new Set<string>()
  const providers = source.builtinProviders().map((provider, index): GeneratedPiAiProvider => {
    const id = requiredString(provider.id, `builtinProviders()[${String(index)}].id`)
    unique(id, providerIds, 'runtime provider id')
    const name = requiredString(provider.name, `builtinProviders()[${String(index)}].name`)
    if (provider.baseUrl !== undefined && typeof provider.baseUrl !== 'string') {
      throw new Error(`gen-pi-ai-catalog: builtinProviders()[${String(index)}].baseUrl must be a string`)
    }
    const auth = recordOf(provider.auth)
    if (auth === undefined) {
      throw new Error(`gen-pi-ai-catalog: builtinProviders()[${String(index)}].auth must be an object`)
    }
    return {
      id,
      name,
      ...provider.baseUrl === undefined ? {} : { baseUrl: provider.baseUrl },
      takesApiKey: auth.apiKey !== undefined,
    }
  })

  const staticIds = new Set<string>()
  const catalogProviderIds = source.getBuiltinProviders().map((raw, index) => {
    const id = requiredString(raw, `getBuiltinProviders()[${String(index)}]`)
    unique(id, staticIds, 'catalog provider id')
    if (!providerIds.has(id)) {
      throw new Error(`gen-pi-ai-catalog: catalog provider ${JSON.stringify(id)} has no runtime provider`)
    }
    return id
  })

  const models: Record<string, readonly JsonObject[]> = {}
  for (const provider of catalogProviderIds) {
    const modelIds = new Set<string>()
    const entries = source.getBuiltinModels(provider)
    if (!Array.isArray(entries)) {
      throw new Error(`gen-pi-ai-catalog: getBuiltinModels(${JSON.stringify(provider)}) must return an array`)
    }
    models[provider] = entries.map((model, index) => {
      const path = `getBuiltinModels(${JSON.stringify(provider)})[${String(index)}]`
      const canonical = canonicalJson(model, path)
      const entry = recordOf(canonical) as JsonObject | undefined
      if (entry === undefined) throw new Error(`gen-pi-ai-catalog: ${path} must be an object`)
      const id = requiredString(entry.id, `${path}.id`)
      unique(id, modelIds, `model id for provider ${JSON.stringify(provider)}`)
      if (entry.provider !== provider) {
        throw new Error(
          `gen-pi-ai-catalog: ${path}.provider must be ${JSON.stringify(provider)}, got ${JSON.stringify(entry.provider)}`,
        )
      }
      return entry
    })
  }
  return { providers, catalogProviderIds, models }
}

function asciiJson(value: unknown, spacing?: number): string {
  const rendered: unknown = JSON.stringify(value, undefined, spacing)
  if (typeof rendered !== 'string') throw new Error('gen-pi-ai-catalog: cannot render an undefined root value')
  return rendered.replace(/[\u0080-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

/**
 * Render the generated TypeScript module.
 * @param catalog - validated catalog snapshot.
 * @returns complete source with exactly one trailing newline.
 */
export function renderPiAiCatalog(catalog: GeneratedPiAiCatalog): string {
  const providerMetadata = Object.fromEntries(catalog.providers.map(({ id, ...metadata }) => [id, metadata]))
  const modelsJson = JSON.stringify(catalog.models)
  return [
    '/**',
    ' * Generated startup metadata for the installed pi-ai catalog.',
    ' * Do not edit by hand; run `pnpm exec tsx scripts/gen-pi-ai-catalog.ts`.',
    ' *',
    ' * @module mnh-llm-pi-ai/catalog.generated',
    ' */',
    '',
    '/** Static provider ids exposed by pi-ai\'s generated model catalog. */',
    'export const PI_AI_CATALOG_PROVIDER_IDS: readonly string[] = Object.freeze(',
    `${asciiJson(catalog.catalogProviderIds, 2)},`,
    ')',
    '',
    '/** Provider facts required by configuration and directory reads. */',
    'export const PI_AI_CATALOG_PROVIDERS: Readonly<Record<string, {',
    '  readonly name: string',
    '  readonly baseUrl?: string',
    '  readonly takesApiKey: boolean',
    `}>> = Object.freeze(${asciiJson(providerMetadata, 2)})`,
    '',
    '/** Complete model data, parsed only when a configured route needs its catalog. */',
    `export const PI_AI_CATALOG_MODELS_JSON = ${asciiJson(modelsJson)}`,
    '',
  ].join('\n')
}

function publicProvidersAllUrl(): string {
  const manifestPath = findPackageJSON('@earendil-works/pi-ai', pathToFileURL(PACKAGE_ANCHOR))
  if (manifestPath === undefined) {
    throw new Error('gen-pi-ai-catalog: @earendil-works/pi-ai is not installed for mnh-llm-pi-ai')
  }
  const manifestValue: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const manifest = recordOf(manifestValue)
  const exportsField = recordOf(manifest?.exports)
  const providersPattern = recordOf(exportsField?.['./providers/*'])
  const targetPattern = providersPattern?.import
  if (typeof targetPattern !== 'string' || !targetPattern.startsWith('./')) {
    throw new Error('gen-pi-ai-catalog: pi-ai does not export ./providers/* through an ESM import target')
  }
  if (targetPattern.split('*').length !== 2) {
    throw new Error('gen-pi-ai-catalog: pi-ai ./providers/* export must contain exactly one wildcard')
  }
  const packageRoot = dirname(manifestPath)
  const target = resolve(packageRoot, targetPattern.replace('*', 'all'))
  const fromPackage = relative(packageRoot, target)
  if (fromPackage === '..' || fromPackage.startsWith(`..${sep}`) || isAbsolute(fromPackage)) {
    throw new Error('gen-pi-ai-catalog: pi-ai ./providers/* export resolves outside its package')
  }
  return pathToFileURL(target).href
}

/**
 * Load pi-ai's public providers/all module from the adapter's dependency tree.
 * @returns the public catalog operations.
 */
export async function loadPiAiCatalogSource(): Promise<PiAiCatalogSource> {
  const imported: unknown = await import(publicProvidersAllUrl())
  const source = recordOf(imported)
  if (typeof source?.builtinProviders !== 'function'
    || typeof source.getBuiltinProviders !== 'function'
    || typeof source.getBuiltinModels !== 'function') {
    throw new Error('gen-pi-ai-catalog: pi-ai providers/all is missing its public catalog operations')
  }
  return source as unknown as PiAiCatalogSource
}

function currentOutput(path: string): string | null {
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf8')
}

/** Generate or freshness-check the fixed catalog source file. */
export async function main(): Promise<void> {
  const source = await loadPiAiCatalogSource()
  const content = renderPiAiCatalog(collectPiAiCatalog(source))
  const output = resolve(root, PI_AI_CATALOG_OUTPUT)
  if (process.argv.includes('--check')) {
    if (currentOutput(output) === content) {
      console.log(`gen-pi-ai-catalog: ${PI_AI_CATALOG_OUTPUT} is up to date.`)
      return
    }
    console.error(
      `gen-pi-ai-catalog: ${PI_AI_CATALOG_OUTPUT} is stale. Run `
      + '`pnpm exec tsx scripts/gen-pi-ai-catalog.ts` and commit it.',
    )
    process.exitCode = 1
    return
  }
  writeFileSync(output, content)
  console.log(`gen-pi-ai-catalog: wrote ${PI_AI_CATALOG_OUTPUT}.`)
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  await main()
}
