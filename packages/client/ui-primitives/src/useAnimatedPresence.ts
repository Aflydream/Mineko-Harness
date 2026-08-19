/** Retained presence for controlled overlays with CSS-owned exit motion. */

import { useCallback, useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

/** State and completion handoff for one controlled animated overlay. */
export interface AnimatedPresence {
  /** Keep rendering while open and through an exit animation. */
  present: boolean
  /** Apply the inverse animation and suppress interaction. */
  closing: boolean
  /** Unmount after the animated element reports its own completion. */
  finishExit: () => void
}

/**
 * Retain a controlled overlay until its CSS exit animation completes.
 * Reopening cancels the pending exit; reduced-motion clients close before paint.
 * @param open - the owner's current visibility state.
 * @param target - optional element whose native `animationend` completes the exit.
 * @returns retained presence, closing state, and the animation completion handoff.
 */
export function useAnimatedPresence(open: boolean, target?: RefObject<HTMLElement | null>): AnimatedPresence {
  const [retained, setRetained] = useState(open)

  useLayoutEffect(() => {
    if (open) {
      setRetained(true)
      return
    }
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRetained(false)
    }
  }, [open])

  const finishExit = useCallback(() => {
    if (!open) setRetained(false)
  }, [open])

  const present = open || retained
  const closing = retained && !open

  useLayoutEffect(() => {
    const element = target?.current
    if (!closing || element === null || element === undefined) return
    const finish = (event: AnimationEvent): void => {
      if (event.target === element) finishExit()
    }
    element.addEventListener('animationend', finish)
    return () => { element.removeEventListener('animationend', finish) }
  }, [closing, finishExit, target])

  return { present, closing, finishExit }
}
