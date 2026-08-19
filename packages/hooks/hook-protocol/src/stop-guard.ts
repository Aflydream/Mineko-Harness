/**
 * Bounds continuation requests made by a blocking Stop hook.
 *
 * A Stop hook can feed a steering message back into the same turn. That is a
 * useful control-flow seam, but a hook that keeps returning a blocking result
 * must not be able to keep a turn alive forever. The guard is keyed by the
 * live agent object and resets automatically when the turn number changes.
 */

/** Default maximum number of extra model steps a Stop hook may request per turn. */
export const DEFAULT_MAX_STOP_CONTINUATIONS = 32

/** Hard ceiling for configuration values, keeping the safety valve finite and practical. */
export const MAX_STOP_CONTINUATIONS = 1000

interface StopState {
  turn: number
  continuations: number
}

export interface StopContinuationGuard {
  /** Whether this turn has already been continued by a Stop hook. */
  isActive(agent: object, turn: number): boolean
  /** Record one continuation, returning false once the configured cap is reached. */
  tryContinue(agent: object, turn: number): boolean
}

/** Create a per-plugin guard with weak agent keys so completed agents are collectible. */
export function createStopContinuationGuard(maxContinuations = DEFAULT_MAX_STOP_CONTINUATIONS): StopContinuationGuard {
  if (!Number.isSafeInteger(maxContinuations) || maxContinuations < 1 || maxContinuations > MAX_STOP_CONTINUATIONS) {
    throw new Error(`maxStopContinuations must be a safe integer between 1 and ${MAX_STOP_CONTINUATIONS}`)
  }

  const states = new WeakMap<object, StopState>()

  function stateFor(agent: object, turn: number): StopState {
    const current = states.get(agent)
    if (current?.turn === turn) return current
    const next = { turn, continuations: 0 }
    states.set(agent, next)
    return next
  }

  return {
    isActive(agent, turn) {
      const state = states.get(agent)
      return state?.turn === turn && state.continuations > 0
    },
    tryContinue(agent, turn) {
      const state = stateFor(agent, turn)
      if (state.continuations >= maxContinuations) return false
      state.continuations++
      return true
    },
  }
}
