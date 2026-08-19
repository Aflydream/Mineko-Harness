/** Package-owned invariant companion for `@aflydream/mnh-attachment`. @module @aflydream/mnh-attachment/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@aflydream/mnh-invariants'

const PACKAGE_NAME = '@aflydream/mnh-attachment'
/** Cordis companion plugin name. */
export const name = 'attachment-invariant'
/** Service required before package ownership can be reserved. */
export const inject = ['invariants']
/** No runtime invariant: this stateless seam owns types while implementations enforce immutable-store checks. */
const install: InvariantInstaller = () => {}
/**
 * Register the package invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
