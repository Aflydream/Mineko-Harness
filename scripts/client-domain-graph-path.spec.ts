import { describe, expect, it } from 'vitest'
import { resolveClientRelative } from './client-domain-graph-path.ts'

describe('client domain graph path resolution', () => {
  it('preserves traversal above the client directory', () => {
    expect(resolveClientRelative('', '../core/detect.ts')).toBe('../core/detect.ts')
    expect(resolveClientRelative('domain', '../../core/contract.ts')).toBe('../core/contract.ts')
  })

  it('normalizes imports that stay inside the client directory', () => {
    expect(resolveClientRelative('skeleton/panel', '../../contract/slots.ts'))
      .toBe('contract/slots.ts')
  })
})
