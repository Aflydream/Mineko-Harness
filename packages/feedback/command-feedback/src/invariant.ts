/**
 * Package-owned invariant companion for `@aflydream/mnh-command-feedback`.
 * @module @aflydream/mnh-command-feedback/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@aflydream/mnh-invariants'

const PACKAGE_NAME = '@aflydream/mnh-command-feedback'

/** Cordis companion plugin name. */
export const name = 'command-feedback-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: each `feedback/record` is an independent append-only
 * fact with no cross-event or mutable-data relationship.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
