/**
 * Package-owned invariant companion for `@aflydream/mnh-tool-subagent-report`.
 * @module @aflydream/mnh-tool-subagent-report/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@aflydream/mnh-invariants'

const PACKAGE_NAME = '@aflydream/mnh-tool-subagent-report'

/** Cordis companion plugin name. */
export const name = 'tool-subagent-report-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this adapter has no independent lifecycle stream;
 * sender authorization and delivery relations belong to the subagent service.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - context carrying the invariant service.
 * @returns the registration disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
