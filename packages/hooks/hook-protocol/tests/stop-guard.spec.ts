import { describe, expect, it } from 'vitest'
import { createStopContinuationGuard, DEFAULT_MAX_STOP_CONTINUATIONS, MAX_STOP_CONTINUATIONS } from '@aflydream/mnh-hook-protocol/src/stop-guard.ts'

describe('stop continuation guard', () => {
  it('limits one turn and resets for the next turn', () => {
    const guard = createStopContinuationGuard(2)
    const agent = {}

    expect(guard.isActive(agent, 1)).toBe(false)
    expect(guard.tryContinue(agent, 1)).toBe(true)
    expect(guard.isActive(agent, 1)).toBe(true)
    expect(guard.tryContinue(agent, 1)).toBe(true)
    expect(guard.tryContinue(agent, 1)).toBe(false)

    expect(guard.isActive(agent, 2)).toBe(false)
    expect(guard.tryContinue(agent, 2)).toBe(true)
  })

  it('uses a bounded default and rejects unsafe limits', () => {
    expect(DEFAULT_MAX_STOP_CONTINUATIONS).toBeGreaterThan(1)
    expect(DEFAULT_MAX_STOP_CONTINUATIONS).toBeLessThanOrEqual(MAX_STOP_CONTINUATIONS)
    expect(() => createStopContinuationGuard(0)).toThrow(/maxStopContinuations/)
    expect(() => createStopContinuationGuard(MAX_STOP_CONTINUATIONS + 1)).toThrow(/maxStopContinuations/)
    expect(() => createStopContinuationGuard(Infinity)).toThrow(/maxStopContinuations/)
  })
})
