import type { ContextPressureProjection } from '@aflydream/mnh-token-meter/client'

/**
 * Compact token count: 517 / 12.2K / 517K / 1.2M (one decimal under three digits).
 * @param n - token count.
 * @returns display string.
 */
export function formatTokens(n: number): string {
  const scaled = (v: number): string =>
    v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${scaled(n / 1_000)}K`
  return `${scaled(n / 1_000_000)}M`
}

interface ContextOccupancy {
  percent: number
  usedTokens: number
  contextWindow: number
}

/**
 * Approximate context occupancy, using the TUI's integer rounding and upper
 * clamp. The numerator is `projectedTokens` — the provider sample carried
 * forward over the surface's movement since — so compaction shows immediately
 * instead of waiting for the next request to report usage; it falls back to the
 * bare sample only for a log whose projection predates that field. Numerator
 * and capacity remain independent last-wins projection fields, so this is a
 * reference figure rather than an exact measurement of one request (see the
 * token-meter README).
 * @param pressure - the session's context-pressure projection value.
 * @returns occupancy with its numerator and denominator, or null until both values are known.
 */
export function contextOccupancy(
  pressure: ContextPressureProjection | undefined,
): ContextOccupancy | null {
  const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens
  if (usedTokens === undefined || pressure?.contextWindow === undefined) return null
  return {
    percent: Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100)),
    usedTokens,
    contextWindow: pressure.contextWindow,
  }
}
