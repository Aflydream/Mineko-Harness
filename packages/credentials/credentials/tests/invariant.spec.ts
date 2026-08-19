import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@aflydream/mnh-invariants'
import { credentialRef } from '../src/index.ts'
import * as CredentialsInvariant from '../src/invariant.ts'
import { MemoryCredentials } from './memory.ts'

const REF = credentialRef('DEEPSEEK_API_KEY')

describe('credentials invariant companion', () => {
  it('accepts a committed change emitted by a live service', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry)
    await ctx.plugin(CredentialsInvariant)
    await ctx.plugin(MemoryCredentials)

    await expect(ctx.credentials.set(REF, 'sk-live')).resolves.toBeUndefined()
  })

  it('fails an update event emitted without a live service', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry)
    await ctx.plugin(CredentialsInvariant)

    expect(() => { ctx.emit('credentials/updated', REF) }).toThrow(/invariant violated by "@aflydream\/mnh-credentials"/)
  })

  it('reserves the package name against duplicate registration', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry)
    await ctx.plugin(CredentialsInvariant)

    expect(() => {
      ctx.invariants.register('@aflydream/mnh-credentials', () => {})
    }).toThrow(/already registered/)
  })
})
