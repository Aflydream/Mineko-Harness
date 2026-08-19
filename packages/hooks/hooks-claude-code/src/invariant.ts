/**
 * Package-owned invariant companion for `@aflydream/mnh-hooks-claude-code`.
 * @module @aflydream/mnh-hooks-claude-code/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@aflydream/mnh-invariants'

const PACKAGE_NAME = '@aflydream/mnh-hooks-claude-code'

/** Cordis companion plugin name. */
export const name = 'hooks-claude-code-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this bridge publishes hook-protocol session events, whose companion owns
 * which invocation event each result cites.
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
