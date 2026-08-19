/**
 * Shared browser platform modules. Seeding, bundling externals, and Vite
 * aliases consume this list so their module identities cannot drift.
 * @module @aflydream/mnh-client-web/src/platform
 */

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@aflydream/mnh-client-ui-slots',
  '@aflydream/mnh-client-web-react',
  '@aflydream/mnh-client-ui-primitives',
  '@aflydream/mnh-client-ui-attachment',
  '@aflydream/mnh-client-schema-form',
] as const

/** One platform module specifier (a seed-table key). */
export type PlatformModule = (typeof PLATFORM_MODULES)[number]
