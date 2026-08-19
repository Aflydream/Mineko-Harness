/**
 * Profile discovery, initialization, and patch-layer composition for the
 * `mnh --profile` launcher family.
 *
 * A profile is a directory under `$MNH_HOME/profiles/<name>` holding a
 * `package.json` (out-of-tree plugin dependencies plus the profile manifest
 * `mnh.profile` with its ordered `bundles` list) and a `cordis.patch.yml`
 * (the user's own patch layer, applied after every bundle layer). Bundles are
 * npm packages whose manifest declares
 * `"mnh": { "bundle": { "patch": "./cordis.patch.yml" } }`; the tree is
 * composed by applying each bundle's patch list in `mnh.profile.bundles` order over
 * an empty entry list, then the profile's own patches, then any launcher
 * layers (`--patch` files and flag-derived patches).
 *
 * Module resolution is two-anchor by construction: a bundle name resolves
 * first from the mnh installation (the launcher's own package), then from the
 * profile directory. The Loader's `baseUrl` is the profile directory, whose
 * `node_modules` pnpm manages for out-of-tree plugins, while the maintained
 * per-installation fallback directory
 * `$MNH_HOME/profiles/.module-fallback/<installation>/node_modules` (one
 * symlink per package the installation's app and bundles depend on) is selected
 * by the app boot resolver for missing package requests. A second mnh
 * installation therefore cannot change the package graph of a running process.
 * @module @aflydream/mnh-app-boot/profile
 */

import { createHash, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statSync,
  symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import { applyEntryPatches, type PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { resolveMnhHome } from '@aflydream/mnh-home-paths'
import { loadOverlayPatches } from './index.ts'

/** Directory under the Harness home holding every profile. */
export const PROFILES_DIR = 'profiles'

/** The user patch layer inside a profile directory (hot-reloaded on long-lived surfaces). */
export const PROFILE_PATCH_FILENAME = 'cordis.patch.yml'

/** The bundle half of the `mnh` manifest section: what a bundle package exports. */
export interface MnhBundleManifest {
  /** The patch layer this bundle exports, relative to its package root. */
  patch: string
}

/** The profile half of the `mnh` manifest section: what a profile directory composes. */
export interface MnhProfileManifest {
  /** Ordered bundle layer list (package names). */
  bundles?: string[]
}

/**
 * The profile-launcher slice of the `mnh`-owned package.json section. A
 * manifest may declare both roles; other consumers own additional keys.
 */
export interface MnhManifestSection {
  /** Bundle metadata consumed by the profile launcher. */
  bundle?: MnhBundleManifest
  /** Profile metadata consumed by the profile launcher. */
  profile?: MnhProfileManifest
}

/** The slice of package.json both profiles and bundles use. */
export interface ProfileManifest {
  name?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  mnh?: MnhManifestSection
}

/** One resolved bundle layer of a profile. */
export interface ProfileLayer {
  /** The bundle's package name, as listed in `mnh.profile.bundles`. */
  packageName: string
  /** Absolute directory of the resolved bundle package. */
  packageDir: string
  /** Absolute path of the bundle's patch file. */
  patchPath: string
  /** The parsed patch list. */
  patches: PatchOptions[]
}

/** A loaded profile: resolved bundle layers plus the user's own patch layer. */
export interface Profile {
  /** The profile name (its directory basename). */
  name: string
  /** Absolute profile directory. */
  dir: string
  /** Bundle layers in `mnh.profile.bundles` order. */
  layers: ProfileLayer[]
  /** Absolute path of the profile's own patch file. */
  patchPath: string
  /** The profile's own patches; empty when the file is absent. */
  patches: PatchOptions[]
}

/**
 * Resolve a profile's directory under the Harness home.
 * @param name - the profile name (`mnh --profile <name>`).
 * @param home - the Harness home; defaults to {@link resolveMnhHome}.
 * @returns the absolute profile directory (which may not exist yet).
 */
export function resolveProfileDir(name: string, home: string = resolveMnhHome()): string {
  if (name === '' || name.includes('/') || name.includes('\\') || name === '.' || name === '..'
    // Reserved for migration from the pre-isolation module fallback.
    || name === 'node_modules') {
    throw new Error(`mnh: invalid profile name ${JSON.stringify(name)}`)
  }
  return join(home, PROFILES_DIR, name)
}

/** The shipped profile templates auto-initialized on first use, by name. */
export const PROFILE_TEMPLATES: Record<string, readonly string[]> = {
  web: ['@aflydream/mnh-base', '@aflydream/mnh-web-app'],
  desktop: ['@aflydream/mnh-base', '@aflydream/mnh-web-app', '@aflydream/mnh-desktop-app'],
  headless: ['@aflydream/mnh-base', '@aflydream/mnh-headless'],
}

/** Installation-owned bundle tuples normalized to the shipped template. */
const INSTALLATION_OWNED_PROFILE_TUPLES: Record<string, readonly string[]> = {
  headless: ['@aflydream/mnh-base', '@aflydream/mnh-web-app', '@aflydream/mnh-headless'],
}

/** The bundle list a `mnh plugin` init uses for a name with no shipped template. */
export const DEFAULT_PROFILE_BUNDLES: readonly string[] = ['@aflydream/mnh-base']

const PROFILE_PATCH_TEMPLATE = `# Your patch layer for this mnh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
[]
`

// The hoisted linker gives out-of-tree plugins a flat node_modules. Missing
// peers (cordis and friends) fall through to the installation-specific module
// fallback selected by app boot, so every plugin shares that installation's
// single cordis instance instead of a duplicate. pnpm ≥10
// reads its settings from pnpm-workspace.yaml, not .npmrc.
const PROFILE_PNPM_WORKSPACE = `packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
`

const MODULE_FALLBACK_DIRECTORY = '.module-fallback'
const MODULE_FALLBACK_STAMP_FILENAME = 'stamp.json'
const MODULE_FALLBACK_LOCK_FILENAME = 'repair.lock'
const MODULE_FALLBACK_STAMP_VERSION = 2
const INSTALL_LOCKFILES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'] as const

// These are coordination protocol limits, not deployment tunables. Repair is
// normally sub-second; a contender fails instead of guessing that another
// process's lock is abandoned.
const MODULE_FALLBACK_LOCK_RETRY_INITIAL_MS = 20
const MODULE_FALLBACK_LOCK_RETRY_MAX_MS = 200
const MODULE_FALLBACK_LOCK_TIMEOUT_MS = 2_000
const MODULE_FALLBACK_LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4))

interface PathFingerprint {
  path: string
  size: number
  mtimeMs: number
}

interface FileFingerprint extends PathFingerprint {
  sha256: string
}

interface InstallationFingerprint {
  installAnchor: string
  appManifest: FileFingerprint
  lockfiles: FileFingerprint[]
  installModules: PathFingerprint | null
}

interface ModuleFallbackStamp extends InstallationFingerprint {
  version: number
  fallbackModules: PathFingerprint
  fallbackScopes: PathFingerprint[]
}

/**
 * Initialize a profile directory: manifest, empty user patch layer, and the
 * pnpm settings out-of-tree plugins need. Existing files are never touched,
 * so re-running is a no-op on an initialized profile.
 * @param dir - the profile directory from {@link resolveProfileDir}.
 * @param bundles - the initial `mnh.profile.bundles` layer list.
 */
export function initProfile(dir: string, bundles: readonly string[]): void {
  mkdirSync(dir, { recursive: true })
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) {
    const manifest: ProfileManifest & { private: boolean } = {
      name: `mnh-profile-${basename(dir)}`,
      private: true,
      dependencies: {},
      mnh: { profile: { bundles: [...bundles] } },
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, undefined, 2) + '\n')
  }
  const patchPath = join(dir, PROFILE_PATCH_FILENAME)
  if (!existsSync(patchPath)) writeFileSync(patchPath, PROFILE_PATCH_TEMPLATE)
  const workspacePath = join(dir, 'pnpm-workspace.yaml')
  if (!existsSync(workspacePath)) writeFileSync(workspacePath, PROFILE_PNPM_WORKSPACE)
}

/** Whether a filesystem operation failed with `code`. */
function hasErrorCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === code
}

/** Ensure `link` is a symlink to `target`, replacing a wrong or dangling link; a real directory throws. */
function ensureSymlink(link: string, target: string): void {
  let stat: ReturnType<typeof lstatSync> | undefined
  try {
    stat = lstatSync(link)
  } catch (error) {
    /* v8 ignore next -- non-absence lstat failures require platform-specific permissions */
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  if (stat !== undefined) {
    if (!stat.isSymbolicLink()) {
      throw new Error(`mnh: ${link} exists and is not a symlink; remove it so mnh can manage the installation fallback`)
    }
    if (readlinkSync(link) === target) return
    // unlink deletes the reparse point itself on Windows too; rmSync treats a
    // junction as a directory and throws EISDIR unless recursive.
    unlinkSync(link)
  }
  symlinkSync(target, link, 'junction')
}

/** Return the stable metadata used to detect a changed file or directory. */
function pathFingerprint(path: string): PathFingerprint {
  const stat = statSync(path)
  return { path, size: stat.size, mtimeMs: stat.mtimeMs }
}

/** Return metadata plus a content digest for an installation identity file. */
function fileFingerprint(path: string): FileFingerprint {
  return {
    ...pathFingerprint(path),
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  }
}

/** Return metadata for an optional path, while preserving non-absence failures. */
function optionalPathFingerprint(path: string): PathFingerprint | undefined {
  try {
    return pathFingerprint(path)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return undefined
    throw error
  }
}

/** Return content fingerprints for every supported lockfile in the nearest matching ancestor. */
function lockfileFingerprints(dir: string): FileFingerprint[] {
  return INSTALL_LOCKFILES
    .filter(filename => existsSync(join(dir, filename)))
    .map(filename => fileFingerprint(join(dir, filename)))
}

/** Find every supported lockfile in the nearest ancestor that contains one. */
function nearestLockfiles(installAnchor: string): FileFingerprint[] {
  for (let dir = dirname(installAnchor);;) {
    const found = lockfileFingerprints(dir)
    if (found.length > 0) return found
    const parent = dirname(dir)
    if (parent === dir) return []
    dir = parent
  }
}

/** Capture the installation inputs that determine the fallback link set. */
function installationFingerprint(installAnchor: string): InstallationFingerprint {
  return {
    installAnchor,
    appManifest: fileFingerprint(installAnchor),
    lockfiles: nearestLockfiles(installAnchor),
    installModules: optionalPathFingerprint(join(dirname(installAnchor), 'node_modules')) ?? null,
  }
}

/** Run one validation-and-repair cycle while holding the profile fallback writer lock. */
function withModuleFallbackLock<T>(lockPath: string, operation: () => T): T {
  const deadline = Date.now() + MODULE_FALLBACK_LOCK_TIMEOUT_MS
  let delay = MODULE_FALLBACK_LOCK_RETRY_INITIAL_MS
  for (;;) {
    try {
      writeFileSync(lockPath, `${process.pid}\n`, { flag: 'wx', mode: 0o600 })
      break
    } catch (error) {
      /* v8 ignore next -- non-EEXIST exclusive-create failures require platform-specific permissions */
      if (!hasErrorCode(error, 'EEXIST')) throw error
    }
    if (Date.now() >= deadline) {
      throw new Error(`mnh: timed out waiting for the profile module fallback lock at ${lockPath}`)
    }
    Atomics.wait(MODULE_FALLBACK_LOCK_WAIT, 0, 0, delay)
    delay = Math.min(delay * 2, MODULE_FALLBACK_LOCK_RETRY_MAX_MS)
  }
  try {
    return operation()
  } finally {
    rmSync(lockPath, { force: true })
  }
}

/** Replace the derived stamp atomically so interruption cannot leave a partial record. */
function writeModuleFallbackStamp(stampPath: string, content: string): void {
  const temporary = `${stampPath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  try {
    writeFileSync(temporary, content, { flag: 'wx', mode: 0o600 })
    renameSync(temporary, stampPath)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

/** Serialize the derived stamp deterministically, including its required trailing newline. */
function renderModuleFallbackStamp(
  installation: InstallationFingerprint, modulesDir: string,
): string {
  const stamp: ModuleFallbackStamp = {
    version: MODULE_FALLBACK_STAMP_VERSION,
    ...installation,
    fallbackModules: pathFingerprint(modulesDir),
    fallbackScopes: readdirSync(modulesDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith('@'))
      .map(entry => pathFingerprint(join(modulesDir, entry.name)))
      .sort((left, right) => left.path.localeCompare(right.path)),
  }
  return `${JSON.stringify(stamp, undefined, 2)}\n`
}

/** Return every symlink currently occupying a package slot in the managed fallback. */
function fallbackLinks(modulesDir: string): Map<string, string> {
  const links = new Map<string, string>()
  for (const entry of readdirSync(modulesDir, { withFileTypes: true })) {
    const entryPath = join(modulesDir, entry.name)
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      for (const child of readdirSync(entryPath, { withFileTypes: true })) {
        if (child.isSymbolicLink()) links.set(`${entry.name}/${child.name}`, join(entryPath, child.name))
      }
    } else if (entry.isSymbolicLink()) {
      links.set(entry.name, entryPath)
    }
  }
  return links
}

/** Create a real scope directory, rejecting a file or reparse point in its place. */
function ensureFallbackParent(modulesDir: string, link: string): void {
  const parent = dirname(link)
  if (parent === modulesDir) return
  let stat: ReturnType<typeof lstatSync> | undefined
  try {
    stat = lstatSync(parent)
  } catch (error) {
    /* v8 ignore next -- non-absence lstat failures require platform-specific permissions */
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  if (stat === undefined) {
    mkdirSync(parent)
  } else if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`mnh: ${parent} exists and is not a real scope directory; remove it so mnh can manage the installation fallback`)
  }
}

/** Require a managed directory to be a real directory before traversing it. */
function assertRealDirectory(path: string, role: string): void {
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`mnh: ${path} is not a real ${role}; remove it so mnh can manage the installation fallback`)
  }
}

/** Create one managed directory without ever following a reparse point. */
function ensureRealDirectory(path: string, role: string): void {
  try {
    mkdirSync(path)
  } catch (error) {
    /* v8 ignore next -- non-EEXIST mkdir failures require platform-specific permissions */
    if (!hasErrorCode(error, 'EEXIST')) throw error
  }
  assertRealDirectory(path, role)
}

/** Return the stable storage directory for one physical mnh installation. */
function moduleFallbackDirectory(installAnchor: string, home: string): string {
  const canonical = realpathSync.native(installAnchor)
  /* v8 ignore next -- the opposite path-casing branch runs on non-Windows CI */
  const identity = process.platform === 'win32' ? canonical.toLowerCase() : canonical
  const id = createHash('sha256').update(identity).digest('hex')
  return join(home, PROFILES_DIR, MODULE_FALLBACK_DIRECTORY, id)
}

/** Move the pre-isolation fallback aside so it cannot shadow an installation slot. */
function quarantineLegacyFallback(profilesDir: string): void {
  const legacy = join(profilesDir, 'node_modules')
  let stat: ReturnType<typeof lstatSync>
  try {
    stat = lstatSync(legacy)
  } catch (error) {
    /* v8 ignore else -- non-absence lstat failures require platform-specific permissions */
    if (hasErrorCode(error, 'ENOENT')) return
    /* v8 ignore next -- same host failure as the ignored branch above */
    throw error
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`mnh: ${legacy} is not a real directory; remove it so mnh can migrate the installation fallback`)
  }
  const quarantine = join(profilesDir, `${MODULE_FALLBACK_DIRECTORY}.legacy`)
  if (existsSync(quarantine)) {
    throw new Error(`mnh: both ${legacy} and ${quarantine} exist; remove the legacy fallback so mnh can continue`)
  }
  /* v8 ignore next 9 -- requires another process to win this exact rename window or hold the directory open */
  try {
    renameSync(legacy, quarantine)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') && !existsSync(legacy)) return
    throw new Error(
      `mnh: failed to move the legacy profile module fallback from ${legacy} to ${quarantine}; stop every mnh process using that directory and retry`,
      { cause: error },
    )
  }
}

/** Populate or repair every installation-owned link in one fallback slot. */
function healModuleFallbackLinks(installAnchor: string, modulesDir: string): void {
  const appManifest = JSON.parse(readFileSync(installAnchor, 'utf8')) as ProfileManifest
  const links = new Map<string, string>()
  /* v8 ignore next -- a real app manifest always declares its name */
  if (appManifest.name !== undefined) links.set(appManifest.name, dirname(installAnchor))
  // BFS over the resolvable dependency and peer graph; the visited set is the link
  // map itself (first resolution wins, matching Node's own nearest-wins).
  const queue: { anchor: string; manifest: ProfileManifest }[] = [{ anchor: installAnchor, manifest: appManifest }]
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    // Peer dependencies participate: Service Definition packages (mnh-subprocess,
    // mnh-compaction, ...) are peers of their implementations, never plain
    // dependencies, yet out-of-tree plugins import them directly.
    /* v8 ignore next -- a real app manifest always declares dependencies */
    for (const dep of [...Object.keys(next.manifest.dependencies ?? {}), ...Object.keys(next.manifest.peerDependencies ?? {})]) {
      if (links.has(dep)) continue
      const dir = packageDirFromAnchor(next.anchor, dep)
      // A declared-but-uninstalled dependency cannot be a loader-visible
      // plugin; skip it rather than fail the whole boot.
      if (dir === undefined) continue
      links.set(dep, dir)
      const manifestPath = join(dir, 'package.json')
      queue.push({ anchor: manifestPath, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) as ProfileManifest })
    }
  }
  for (const [packageName, link] of fallbackLinks(modulesDir)) {
    if (!links.has(packageName)) unlinkSync(link)
  }
  for (const [packageName, target] of links) {
    const link = join(modulesDir, packageName)
    ensureFallbackParent(modulesDir, link)
    ensureSymlink(link, target)
  }
}

/**
 * Maintain the per-installation module fallback
 * `$MNH_HOME/profiles/.module-fallback/<installation>/node_modules`: one
 * symlink per package in the mnh app's resolvable dependency closure (BFS
 * over `dependencies` and `peerDependencies`), each resolved from its own
 * real location. The app boot resolver keeps a profile's own `node_modules`
 * authoritative and retries missing package requests from this installation
 * slot, so pnpm never manages in-box plugins in the profile. The closure
 * (not just direct dependencies) is
 * required for out-of-tree plugins: their peer dependencies name Service
 * Definition packages (`mnh-compaction`, `mnh-invariants`, ...) that the app
 * reaches only through its Service Provider packages. Symlinked packages
 * resolve their own dependencies from their real directories (Node's default
 * symlink-following), so each package needs only its one flat link.
 * A derived stamp skips the dependency traversal while the installation
 * anchor, nearest package-manager lockfiles, installation node_modules, and
 * fallback root and scope-directory metadata remain unchanged. File content
 * digests distinguish installer-preserved timestamps. One cross-process lock
 * serializes validation and repair; stamp replacement is atomic, correct links
 * are kept, moved installations are re-pointed, and obsolete managed links are
 * removed.
 * @param installAnchor - absolute path of the mnh app's package.json.
 * @param home - the Harness home; defaults to {@link resolveMnhHome}.
 * @returns a file URL inside this installation's fallback slot. Pass it to
 * {@link installModuleFallback} before mounting the profile tree.
 */
export function healProfilesModuleFallback(installAnchor: string, home: string = resolveMnhHome()): string {
  const profilesDir = join(home, PROFILES_DIR)
  mkdirSync(profilesDir, { recursive: true })
  quarantineLegacyFallback(profilesDir)
  const stateDir = moduleFallbackDirectory(installAnchor, home)
  const storeDir = dirname(stateDir)
  mkdirSync(storeDir, { recursive: true })
  assertRealDirectory(storeDir, 'fallback store directory')
  ensureRealDirectory(stateDir, 'installation fallback directory')
  const modulesDir = join(stateDir, 'node_modules')
  ensureRealDirectory(modulesDir, 'fallback module directory')
  const stampPath = join(stateDir, MODULE_FALLBACK_STAMP_FILENAME)
  const lockPath = join(stateDir, MODULE_FALLBACK_LOCK_FILENAME)
  withModuleFallbackLock(lockPath, () => {
    const initial = installationFingerprint(installAnchor)
    const expected = renderModuleFallbackStamp(initial, modulesDir)
    try {
      if (readFileSync(stampPath, 'utf8') === expected) return
    } catch {
      // A missing, unreadable, or partial derived stamp cannot validate links;
      // the full repair below either replaces it or reports the write failure.
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const before = installationFingerprint(installAnchor)
      healModuleFallbackLinks(installAnchor, modulesDir)
      const after = installationFingerprint(installAnchor)
      /* v8 ignore next 4 -- requires a package manager to mutate the installation during this synchronous repair */
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        if (attempt === 0) continue
        throw new Error('mnh: installation changed repeatedly while repairing the profile module fallback')
      }
      writeModuleFallbackStamp(stampPath, renderModuleFallbackStamp(after, modulesDir))
      return
    }
  })
  return pathToFileURL(join(stateDir, 'resolver.mjs')).href
}

/**
 * Read a profile's manifest.
 * @param binName - the diagnostic prefix on the thrown error.
 * @param dir - the profile directory.
 * @returns the parsed manifest.
 */
export function readProfileManifest(binName: string, dir: string): ProfileManifest {
  const path = join(dir, 'package.json')
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(`${binName}: failed to read profile manifest ${path}: ${String(error)}`)
  }
  // The field checks below validate the file data before trusting the parse type.
  const parsed = JSON.parse(raw) as ProfileManifest | null
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${binName}: profile manifest ${path} must hold a JSON object`)
  }
  return parsed
}

/**
 * Write a profile's manifest back (2-space JSON, trailing newline).
 * @param dir - the profile directory.
 * @param manifest - the manifest value to persist.
 */
export function writeProfileManifest(dir: string, manifest: ProfileManifest): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest, undefined, 2) + '\n')
}

/** Return whether two bundle lists have the same values in the same order. */
function sameBundles(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * Normalize an exact installation-owned bundle tuple to its shipped template
 * while preserving every other manifest field. Any other list is user-owned.
 */
function normalizeShippedProfile(name: string, dir: string, manifest: ProfileManifest): ProfileManifest {
  const installationOwned = INSTALLATION_OWNED_PROFILE_TUPLES[name]
  const current = PROFILE_TEMPLATES[name]
  const bundles = manifest.mnh?.profile?.bundles
  if (installationOwned === undefined || current === undefined || bundles === undefined
    || !sameBundles(bundles, installationOwned)) return manifest
  const normalized: ProfileManifest = {
    ...manifest,
    mnh: {
      ...manifest.mnh,
      profile: { ...manifest.mnh?.profile, bundles: [...current] },
    },
  }
  writeProfileManifest(dir, normalized)
  return normalized
}

/**
 * Resolve a package's root directory from one anchor without depending on the
 * package exporting `./package.json` (`require.resolve` would need that):
 * probe the require resolution paths for a directory holding the named
 * manifest. This is Node's own node_modules lookup order, so the result
 * matches what the Loader would import from the same anchor, and
 * `existsSync` follows the symlinks pnpm's isolated layout uses.
 */
function packageDirFromAnchor(anchor: string, packageName: string): string | undefined {
  // resolve.paths returns null only for builtins, which no bundle name is.
  /* v8 ignore next */
  for (const searchPath of createRequire(anchor).resolve.paths(packageName) ?? []) {
    const candidate = join(searchPath, packageName)
    if (existsSync(join(candidate, 'package.json'))) return candidate
  }
  return undefined
}

/**
 * Resolve one bundle package's directory: installation anchor first, then the
 * profile directory. The installation-first order is the contract that
 * `@aflydream/mnh-base` (and every other in-box bundle) always comes from
 * the same installation as the running mnh, never from a profile-local copy.
 * Resolution does not require the package to export `./package.json`.
 * @param binName - the diagnostic prefix on the thrown error.
 * @param packageName - the bundle's package name from `mnh.profile.bundles`.
 * @param installAnchor - absolute path of a file inside the mnh app package (its package.json).
 * @param profileDir - the profile directory (second anchor).
 * @returns the bundle package's absolute directory.
 */
export function resolveBundleDir(
  binName: string, packageName: string, installAnchor: string, profileDir: string,
): string {
  for (const anchor of [installAnchor, join(profileDir, 'package.json')]) {
    const dir = packageDirFromAnchor(anchor, packageName)
    if (dir !== undefined) return dir
  }
  throw new Error(
    `${binName}: cannot resolve profile bundle ${JSON.stringify(packageName)} from the mnh installation or ${profileDir}; `
    + `run 'mnh plugin --profile ${basename(profileDir)} install' if its dependency is not installed`,
  )
}

/**
 * Load a profile: resolve every `mnh.profile.bundles` entry to its patch
 * layer and parse the profile's own patch file. A listed bundle without a
 * `mnh.bundle` manifest fails loud — naming a bundle-less package as a layer
 * is a misconfiguration, not "no patches".
 * @param binName - the diagnostic prefix on thrown errors.
 * @param name - the profile name.
 * @param installAnchor - absolute path of the mnh app's package.json (first resolution anchor).
 * @param home - the Harness home; defaults to {@link resolveMnhHome}.
 * @param options - `userLayer: false` skips reading `cordis.patch.yml`, so a
 * bundles-only consumer (`--dump-default-config`, a recovery diagnostic)
 * cannot fail on a broken user layer.
 * @returns the loaded profile (empty `patches` when the user layer is skipped).
 */
export function loadProfile(
  binName: string, name: string, installAnchor: string, home: string = resolveMnhHome(),
  options: { userLayer?: boolean } = {},
): Profile {
  const dir = resolveProfileDir(name, home)
  if (!existsSync(join(dir, 'package.json'))) {
    const template = PROFILE_TEMPLATES[name]
    if (template === undefined) {
      throw new Error(
        `${binName}: profile ${JSON.stringify(name)} does not exist; create it with 'mnh plugin --profile ${name} add <package>'`,
      )
    }
    initProfile(dir, template)
  }
  const manifest = normalizeShippedProfile(name, dir, readProfileManifest(binName, dir))
  // A hand-written profile manifest may omit the mnh section entirely.
  const bundles = manifest.mnh?.profile?.bundles ?? []
  const layers = bundles.map((packageName): ProfileLayer => {
    const packageDir = resolveBundleDir(binName, packageName, installAnchor, dir)
    const bundleManifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as ProfileManifest
    const declared = bundleManifest.mnh?.bundle?.patch
    if (declared === undefined) {
      throw new Error(`${binName}: profile bundle ${JSON.stringify(packageName)} declares no mnh.bundle in its package.json`)
    }
    const patchPath = join(packageDir, declared)
    return { packageName, packageDir, patchPath, patches: loadOverlayPatches(binName, patchPath) }
  })
  const patchPath = join(dir, PROFILE_PATCH_FILENAME)
  const patches = options.userLayer !== false && existsSync(patchPath)
    ? loadOverlayPatches(binName, patchPath)
    : []
  return { name, dir, layers, patchPath, patches }
}

/**
 * Compose patch layers into the effective entry list over an empty root —
 * the same single `applyEntryPatches` call the boot include makes, so flag
 * derivation and config dumps see exactly what mounts.
 * @param layers - patch lists in application order.
 * @param warn - sink for skipped-patch diagnostics; defaults to silent (boot repeats them).
 * @returns the composed entry list.
 */
export function composeEntries(
  layers: readonly PatchOptions[][], warn: (message: string) => void = () => {},
): EntryOptions[] {
  return applyEntryPatches([], structuredClone(layers.flat()), (message: string, ...args: unknown[]) => {
    let index = 0
    warn(message.replace(/%C/g, () => JSON.stringify(args[index++])))
  })
}
