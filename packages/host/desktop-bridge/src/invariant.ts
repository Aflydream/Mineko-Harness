/**
 * Package-owned invariant companion for `@aflydream/mnh-host-desktop-bridge`.
 * @module @aflydream/mnh-host-desktop-bridge/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@aflydream/mnh-invariants'
import type { DesktopBridgeService } from './index.ts'

const PACKAGE_NAME = '@aflydream/mnh-host-desktop-bridge'

/** Cordis companion plugin name. */
export const name = 'host-desktop-bridge-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

const install: InvariantInstaller = (ctx, fail) => {
  ctx.on('internal/plugin', () => {
    const bridge: DesktopBridgeService | undefined = ctx.get('desktopBridge')
    if (bridge === undefined) return
    const probe = { path: '/__mnh_desktop_invariant_probe__', fetch: () => Promise.resolve(new Response()) }
    try {
      bridge.register(probe)()
      bridge.register(probe)()
    } catch {
      fail('desktopBridge route disposer left a route registered')
    }
  }, { global: true })
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
