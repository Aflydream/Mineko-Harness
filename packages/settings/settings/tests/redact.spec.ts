import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { redactSecrets, redactSettingsError, settingsNamespace } from '../src/index.ts'
import { MemorySettings } from './memory.ts'

const Profile = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref'),
  baseURL: z.string(),
})

const Adapter: z<object> = z.object({
  apiKey: z.string().role('secret'),
  providers: z.dict(Profile),
  fallbacks: z.array(Profile),
  nested: z.object({
    token: z.string().role('secret'),
  }),
})

describe('redactSecrets', () => {
  it('strips secrets from object, dict, and array containers and records each position', () => {
    const { value, secrets } = redactSecrets(Adapter as z<never>, {
      apiKey: 'top-secret',
      providers: {
        openai: { apiKey: 'sk-live', apiKeyEnv: 'OPENAI_API_KEY', baseURL: 'https://x' },
        anthropic: { apiKeyEnv: 'ANTHROPIC_API_KEY' },
      },
      fallbacks: [{ apiKey: 'fb', baseURL: 'https://y' }],
      nested: {},
    })
    expect(value).toEqual({
      providers: {
        openai: { apiKeyEnv: 'OPENAI_API_KEY', baseURL: 'https://x' },
        anthropic: { apiKeyEnv: 'ANTHROPIC_API_KEY' },
      },
      fallbacks: [{ baseURL: 'https://y' }],
      nested: {},
    })
    expect(secrets).toEqual([
      { path: ['apiKey'], set: true },
      { path: ['providers', 'openai', 'apiKey'], set: true },
      { path: ['providers', 'anthropic', 'apiKey'], set: false },
      { path: ['fallbacks', '0', 'apiKey'], set: true },
      { path: ['nested', 'token'], set: false },
    ])
  })

  it('enumerates unset object-property slots without inventing containers', () => {
    const { value, secrets } = redactSecrets(Adapter as z<never>, undefined)
    expect(value).toBeUndefined()
    expect(secrets).toEqual([
      { path: ['apiKey'], set: false },
      { path: ['nested', 'token'], set: false },
    ])
  })

  it('never mutates the input and preserves keys outside the schema', () => {
    const input = Object.freeze({
      apiKey: 'frozen',
      extra: Object.freeze({ keep: true }),
    })
    const { value } = redactSecrets(Adapter as z<never>, input)
    expect(input.apiKey).toBe('frozen')
    expect(value).toEqual({ extra: { keep: true }, nested: undefined } as never)
    expect((value as { extra: unknown }).extra).toEqual({ keep: true })
  })

  it('hides a malformed container that declares secrets below it', () => {
    const { value, secrets } = redactSecrets(Adapter as z<never>, {
      providers: 'not-a-dict',
      fallbacks: 'not-an-array',
    })
    expect(value).toEqual({})
    expect(secrets).toEqual([
      { path: ['apiKey'], set: false },
      { path: ['providers'], set: true },
      { path: ['fallbacks'], set: true },
      { path: ['nested', 'token'], set: false },
    ])
  })

  it('treats a secret-role container as one opaque secret leaf', () => {
    const Weird = z.object({ blob: z.object({ inner: z.string() }).role('secret') })
    const { value, secrets } = redactSecrets(Weird as z<never>, { blob: { inner: 'x' } })
    expect(value).toEqual({})
    expect(secrets).toEqual([{ path: ['blob'], set: true }])
  })

  it('drops a dict entry whose entire value is the secret', () => {
    const Tokens = z.object({ tokens: z.dict(z.string().role('secret')) })
    const { value, secrets } = redactSecrets(Tokens as z<never>, { tokens: { a: 'x', b: 'y' } })
    expect(value).toEqual({ tokens: {} })
    expect(secrets).toEqual([
      { path: ['tokens', 'a'], set: true },
      { path: ['tokens', 'b'], set: true },
    ])
  })

  it('tolerates structural nodes missing their relation maps', () => {
    expect(redactSecrets({ type: 'dict' } as never, { k: 'v' })).toEqual({ value: { k: 'v' }, secrets: [] })
    expect(redactSecrets({ type: 'object' } as never, { k: 'v' })).toEqual({ value: { k: 'v' }, secrets: [] })
    expect(redactSecrets({ type: 'array' } as never, ['v'])).toEqual({ value: ['v'], secrets: [] })
  })

  it('redacts every possible composite branch and initialized lazy child', () => {
    const Composite = z.object({
      choice: z.union([
        z.object({ token: z.string().role('secret') }),
        z.object({ token: z.string(), label: z.string() }),
      ]),
      combined: z.intersect([
        z.object({ apiKey: z.string().role('secret') }),
        z.object({ label: z.string() }),
      ]),
      transformed: z.transform(
        z.object({ password: z.string().role('secret'), label: z.string() }),
        value => value,
      ),
      tuple: z.tuple([z.string().role('secret'), z.string()]),
      deferred: z.lazy(() => z.object({ secret: z.string().role('secret') })),
    })
    const { value, secrets } = redactSecrets(Composite as z<never>, {
      choice: { token: 'union-secret', label: 'choice' },
      combined: { apiKey: 'intersection-secret', label: 'combined' },
      transformed: { password: 'transform-secret', label: 'transformed' },
      tuple: ['tuple-secret', 'visible'],
      deferred: { secret: 'lazy-secret' },
    })
    expect(value).toEqual({
      choice: { label: 'choice' },
      combined: { label: 'combined' },
      transformed: { label: 'transformed' },
      tuple: [undefined, 'visible'],
      deferred: {},
    })
    expect(secrets).toEqual([
      { path: ['choice', 'token'], set: true },
      { path: ['combined', 'apiKey'], set: true },
      { path: ['transformed', 'password'], set: true },
      { path: ['tuple', '0'], set: true },
      { path: ['deferred', 'secret'], set: true },
    ])
  })

  it('fails closed for a secret below an unsupported schema kind', () => {
    expect(redactSecrets({
      type: 'custom',
      inner: { type: 'string', meta: { role: 'secret' } },
    } as never, 'secret')).toEqual({
      value: undefined,
      secrets: [{ path: [], set: true }],
    })
  })

  it('fails closed when a stored value contradicts its container kind', () => {
    // A hand-edited document reaches describe() unvalidated (publish keeps the
    // last good resolved value), so a container holding the wrong JSON shape
    // must not hand its contents to a wire surface.
    const Containers = z.object({
      apiKeys: z.dict(z.string().role('secret')),
      tokens: z.array(z.string().role('secret')),
      pair: z.tuple([z.string().role('secret'), z.string()]),
      profile: z.object({ token: z.string().role('secret') }),
      labels: z.dict(z.string()),
    })
    expect(redactSecrets(Containers as z<never>, {
      apiKeys: 'sk-live-dict',
      tokens: 'sk-live-array',
      pair: 'sk-live-tuple',
      profile: 'sk-live-object',
      labels: 'not-a-secret',
    })).toEqual({
      value: { labels: 'not-a-secret' },
      secrets: [
        { path: ['apiKeys'], set: true },
        { path: ['tokens'], set: true },
        { path: ['pair'], set: true },
        { path: ['profile'], set: true },
      ],
    })
  })

  it('keeps a union branch that explains the value out of the fail-closed path', () => {
    const Either = z.object({
      choice: z.union([z.string(), z.dict(z.string().role('secret'))]),
    })
    expect(redactSecrets(Either as z<never>, { choice: 'plain-label' }))
      .toEqual({ value: { choice: 'plain-label' }, secrets: [] })
    expect(redactSecrets(Either as z<never>, { choice: { k: 'sk-live-union' } }))
      .toEqual({ value: { choice: {} }, secrets: [{ path: ['choice', 'k'], set: true }] })
  })
})

describe('redactSettingsError', () => {
  /** The rejection a write's validation actually throws, at a secret path. */
  function schemaRejection(): unknown {
    const Adapter = z.object({ nested: z.object({ apiKey: z.string().role('secret') }) })
    try {
      Adapter({ nested: { apiKey: 12345 } } as never)
      throw new Error('schema accepted an invalid value')
    } catch (error) {
      return error
    }
  }

  it('reports the position a schema rejected without quoting the value', () => {
    const error = schemaRejection()
    // What the seam itself throws is useful in-process and unsafe on a wire:
    // the candidate it validated merges the STORED section, so the quoted value
    // can be a secret the caller never sent.
    expect((error as Error).message).toContain('12345')
    expect(redactSettingsError(error)).toBe(
      "the value at $.nested.apiKey does not satisfy this namespace's schema",
    )
  })

  it('leaves a non-schema rejection to the caller\'s own message', () => {
    expect(redactSettingsError(new Error('settings provider is read-only'))).toBeUndefined()
    expect(redactSettingsError('not an error')).toBeUndefined()
  })
})

describe('describe() layers and redaction', () => {
  const NS = settingsNamespace('adapter')

  async function boot(doc?: Record<string, unknown>) {
    const ctx = new Context()
    await ctx.plugin(MemorySettings, doc === undefined ? undefined : { doc })
    return ctx
  }

  it('exposes detached base and user layers beside the resolved value', async () => {
    const ctx = await boot({ adapter: { baseURL: 'https://user' } })
    const base = { apiKey: 'entry-key', baseURL: 'https://base' }
    ctx.settings.register(NS, Profile, { base })
    const [descriptor] = ctx.settings.describe()
    expect(descriptor?.base).toEqual(base)
    expect(descriptor?.base).not.toBe(base)
    expect(descriptor?.user).toEqual({ baseURL: 'https://user' })
    expect(descriptor?.value).toEqual({ apiKey: 'entry-key', baseURL: 'https://user' })
    ;(descriptor?.user as Record<string, unknown>).baseURL = 'mutated'
    expect(ctx.settings.describe()[0]?.user).toEqual({ baseURL: 'https://user' })
    expect(descriptor?.secrets).toBeUndefined()
  })

  it('omits the layers when neither a base nor a user section exists', async () => {
    const ctx = await boot()
    ctx.settings.register(NS, Profile)
    const [descriptor] = ctx.settings.describe()
    expect(descriptor).not.toHaveProperty('base')
    expect(descriptor).not.toHaveProperty('user')
  })

  it('describes a section that became malformed after registration as having no user layer', async () => {
    const ctx = await boot({ adapter: { baseURL: 'https://user' } })
    const provider = ctx.get('settings') as MemorySettings
    ctx.settings.register(NS, Profile, { base: { baseURL: 'https://base' } })
    provider.pushExternal({ adapter: 5 })
    const [descriptor] = ctx.settings.describe()
    expect(descriptor).not.toHaveProperty('user')
    // The malformed publish kept the last good resolved value.
    expect(descriptor?.value).toEqual({ baseURL: 'https://user' })
  })

  it('redacts a descriptor that has neither base nor user layer', async () => {
    const ctx = await boot()
    ctx.settings.register(NS, Profile)
    const [descriptor] = ctx.settings.describe({ redactSecrets: true })
    expect(descriptor).not.toHaveProperty('base')
    expect(descriptor).not.toHaveProperty('user')
    expect(descriptor?.secrets).toEqual([{ path: ['apiKey'], set: false }])
  })

  it('redacts every layer and enumerates secret slots under redactSecrets', async () => {
    const ctx = await boot({ adapter: { apiKey: 'user-key', baseURL: 'https://user' } })
    ctx.settings.register(NS, Profile, { base: { apiKey: 'entry-key' } })
    const [descriptor] = ctx.settings.describe({ redactSecrets: true })
    expect(descriptor?.value).toEqual({ baseURL: 'https://user' })
    expect(descriptor?.base).toEqual({})
    expect(descriptor?.user).toEqual({ baseURL: 'https://user' })
    expect(descriptor?.secrets).toEqual([{ path: ['apiKey'], set: true }])
    const [verbatim] = ctx.settings.describe()
    expect(verbatim?.value).toEqual({ apiKey: 'user-key', baseURL: 'https://user' })
  })

  it('removes direct and container-embedded secret defaults from the redacted schema', async () => {
    const Defaults = z.object({
      direct: z.string().default('direct-secret').role('secret'),
      profile: z.object({
        token: z.string().role('secret'),
        label: z.string(),
      }).default({ token: 'container-secret', label: 'visible-default' }),
    })
    const ctx = await boot()
    ctx.settings.register(NS, Defaults)
    const [descriptor] = ctx.settings.describe({ redactSecrets: true })
    const envelope = JSON.stringify(descriptor?.schema)
    expect(envelope).not.toContain('direct-secret')
    expect(envelope).not.toContain('container-secret')
    expect(envelope).toContain('visible-default')
    expect(descriptor?.value).toEqual({ profile: { label: 'visible-default' } })
  })
})
