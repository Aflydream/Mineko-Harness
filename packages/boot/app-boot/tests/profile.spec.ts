/**
 * Profile machinery of `mnh-app-boot`: directory resolution and init,
 * manifest round-trips, two-anchor bundle resolution, patch-layer loading,
 * empty-root composition, and the installation module-fallback healing.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync,
  symlinkSync, unlinkSync, utimesSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  composeEntries,
  healProfilesModuleFallback,
  initProfile,
  loadProfile,
  PROFILE_PATCH_FILENAME,
  PROFILE_TEMPLATES,
  readProfileManifest,
  resolveBundleDir,
  resolveProfileDir,
  writeProfileManifest,
} from '../src/index.ts'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'mnh-profile-'))

function fallbackPaths(baseUrl: string): { stateDir: string; modulesDir: string } {
  const stateDir = dirname(fileURLToPath(baseUrl))
  return { stateDir, modulesDir: join(stateDir, 'node_modules') }
}

function waitForChild(child: ChildProcess): Promise<void> {
  let stderr = ''
  child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`child healer exited with code ${String(code)} signal ${String(signal)}: ${stderr}`))
    })
  })
}

function spawnHealer(anchor: string, home: string, result: string): ChildProcess {
  const source = new URL('../src/profile.ts', import.meta.url).href
  const script = `
    import { writeFileSync } from 'node:fs'
    import { healProfilesModuleFallback } from ${JSON.stringify(source)}
    const baseUrl = healProfilesModuleFallback(${JSON.stringify(anchor)}, ${JSON.stringify(home)})
    writeFileSync(${JSON.stringify(result)}, baseUrl)
  `
  return spawn(process.execPath, ['--import', 'tsx/esm', '--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
  })
}

/** Stage a fake installed app: package.json with deps and a node_modules holding bundles. */
function stageInstallation(bundles: Record<string, { patch?: string; deps?: Record<string, string> }>): string {
  const root = tmp()
  const appDir = join(root, 'app')
  mkdirSync(join(appDir, 'node_modules'), { recursive: true })
  const appDeps: Record<string, string> = {}
  for (const [name, spec] of Object.entries(bundles)) {
    appDeps[name] = '0.0.0'
    const dir = join(appDir, 'node_modules', name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name,
      version: '0.0.0',
      dependencies: spec.deps ?? {},
      ...spec.patch === undefined ? {} : { mnh: { bundle: { patch: './cordis.patch.yml' } } },
    }))
    if (spec.patch !== undefined) writeFileSync(join(dir, 'cordis.patch.yml'), spec.patch)
  }
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'mnh-app', dependencies: appDeps }))
  return join(appDir, 'package.json')
}

describe('resolveProfileDir', () => {
  it('joins the home and rejects traversal-shaped names', () => {
    const home = tmp()
    expect(resolveProfileDir('tui', home)).toBe(join(home, 'profiles', 'tui'))
    for (const bad of ['', '.', '..', 'a/b', 'a\\b']) {
      expect(() => resolveProfileDir(bad, home)).toThrow('invalid profile name')
    }
  })
})

describe('initProfile', () => {
  it('creates manifest, user patch layer, and pnpm workspace once, never overwriting', () => {
    const home = tmp()
    const dir = resolveProfileDir('tui', home)
    initProfile(dir, ['@aflydream/mnh-base'])
    const manifest = readProfileManifest('t', dir)
    expect(manifest.mnh?.profile?.bundles).toEqual(['@aflydream/mnh-base'])
    expect(readFileSync(join(dir, PROFILE_PATCH_FILENAME), 'utf8')).toContain('[]')
    expect(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')).toContain('nodeLinker: hoisted')
    // Re-init keeps user edits.
    writeFileSync(join(dir, PROFILE_PATCH_FILENAME), '- id: x\n  config: {}\n')
    initProfile(dir, ['other'])
    expect(readProfileManifest('t', dir).mnh?.profile?.bundles).toEqual(['@aflydream/mnh-base'])
    expect(readFileSync(join(dir, PROFILE_PATCH_FILENAME), 'utf8')).toContain('- id: x')
  })
})

describe('manifest round-trip', () => {
  it('writes and reads back, and fails loud on a broken manifest', () => {
    const dir = tmp()
    writeProfileManifest(dir, { name: 'p', mnh: { profile: { bundles: ['a'] } } })
    expect(readProfileManifest('t', dir).mnh?.profile?.bundles).toEqual(['a'])
    writeFileSync(join(dir, 'package.json'), '[]')
    expect(() => readProfileManifest('t', dir)).toThrow('must hold a JSON object')
    expect(() => readProfileManifest('t', join(dir, 'nope'))).toThrow('failed to read profile manifest')
  })
})

describe('resolveBundleDir', () => {
  it('prefers the installation anchor, falls back to the profile, and fails loud', () => {
    const anchor = stageInstallation({ 'in-box': { patch: '[]\n' } })
    const profileDir = tmp()
    mkdirSync(join(profileDir, 'node_modules', 'local-only'), { recursive: true })
    writeFileSync(join(profileDir, 'package.json'), '{}')
    writeFileSync(join(profileDir, 'node_modules', 'local-only', 'package.json'), JSON.stringify({ name: 'local-only', version: '0.0.0' }))
    expect(resolveBundleDir('t', 'in-box', anchor, profileDir)).toContain('in-box')
    expect(resolveBundleDir('t', 'local-only', anchor, profileDir)).toContain('local-only')
    expect(() => resolveBundleDir('t', 'absent', anchor, profileDir)).toThrow('cannot resolve profile bundle')
  })

  it('resolves a package whose exports map omits ./package.json', () => {
    // Common on npm: an exports map without "./package.json" makes
    // require.resolve('<pkg>/package.json') throw ERR_PACKAGE_PATH_NOT_EXPORTED;
    // resolution must fall through to the paths probe instead of misreporting
    // the installed package as missing.
    const anchor = stageInstallation({})
    const profileDir = tmp()
    writeFileSync(join(profileDir, 'package.json'), '{}')
    const dir = join(profileDir, 'node_modules', 'sealed-bundle')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'sealed-bundle',
      version: '0.0.0',
      exports: { '.': './index.js' },
      mnh: { bundle: { patch: './cordis.patch.yml' } },
    }))
    writeFileSync(join(dir, 'index.js'), '')
    writeFileSync(join(dir, 'cordis.patch.yml'), '[]\n')
    expect(resolveBundleDir('t', 'sealed-bundle', anchor, profileDir)).toBe(dir)
  })
})

describe('loadProfile', () => {
  it('resolves each mnh.profile.bundles entry to its patch layer in order, plus the user layer', () => {
    const anchor = stageInstallation({
      'bundle-a': { patch: '- insert:\n    - id: a\n      name: pkg-a\n' },
      'bundle-b': { patch: '- id: a\n  config:\n    v: 2\n' },
    })
    const home = tmp()
    const dir = resolveProfileDir('demo', home)
    initProfile(dir, ['bundle-a', 'bundle-b'])
    writeFileSync(join(dir, PROFILE_PATCH_FILENAME), '- id: a\n  config:\n    v: 3\n')
    const profile = loadProfile('t', 'demo', anchor, home)
    expect(profile.layers.map(layer => layer.packageName)).toEqual(['bundle-a', 'bundle-b'])
    expect(profile.patches).toHaveLength(1)
    const entries = composeEntries([
      ...profile.layers.map(layer => layer.patches),
      profile.patches,
    ])
    expect(entries).toEqual([{ id: 'a', name: 'pkg-a', config: { v: 3 } }])
    // A hand-made profile without the user layer file or mnh section: empty layers, no throw.
    rmSync(join(dir, PROFILE_PATCH_FILENAME))
    expect(loadProfile('t', 'demo', anchor, home).patches).toEqual([])
    writeProfileManifest(dir, { name: 'bare' })
    const bare = loadProfile('t', 'demo', anchor, home)
    expect(bare.layers).toEqual([])
  })

  it('auto-initializes only shipped templates and fails loud otherwise', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    expect(() => loadProfile('t', 'custom', anchor, home))
      .toThrow('profile "custom" does not exist')
    // The web template auto-initializes on first load. Bundle resolution
    // cannot be asserted to fail here: the source-plane test runner resolves
    // @deepseek-ai/* through tsconfig paths regardless of the staged anchor.
    expect(PROFILE_TEMPLATES.web).toContain('@aflydream/mnh-base')
    try {
      loadProfile('t', 'web', anchor, home)
    } catch {
      // Resolution failure is the plain-Node outcome for this empty anchor.
    }
    expect(readProfileManifest('t', resolveProfileDir('web', home)).mnh?.profile?.bundles)
      .toEqual([...PROFILE_TEMPLATES.web ?? []])
  })

  it('normalizes only the exact installation-owned headless bundle tuple', () => {
    const anchor = stageInstallation({
      '@aflydream/mnh-base': { patch: '[]\n' },
      '@aflydream/mnh-web-app': { patch: '[]\n' },
      '@aflydream/mnh-headless': { patch: '[]\n' },
      'custom-bundle': { patch: '[]\n' },
    })
    const home = tmp()
    const stock = resolveProfileDir('headless', home)
    initProfile(stock, [
      '@aflydream/mnh-base', '@aflydream/mnh-web-app', '@aflydream/mnh-headless',
    ])
    loadProfile('t', 'headless', anchor, home)
    expect(readProfileManifest('t', stock).mnh?.profile?.bundles)
      .toEqual(['@aflydream/mnh-base', '@aflydream/mnh-headless'])

    const customHome = tmp()
    const custom = resolveProfileDir('headless', customHome)
    initProfile(custom, [
      '@aflydream/mnh-base', '@aflydream/mnh-web-app', '@aflydream/mnh-headless', 'custom-bundle',
    ])
    loadProfile('t', 'headless', anchor, customHome)
    expect(readProfileManifest('t', custom).mnh?.profile?.bundles).toEqual([
      '@aflydream/mnh-base', '@aflydream/mnh-web-app', '@aflydream/mnh-headless', 'custom-bundle',
    ])
  })

  it('fails loud when a listed bundle declares no mnh.bundle', () => {
    const anchor = stageInstallation({ 'not-a-bundle': {} })
    const home = tmp()
    const dir = resolveProfileDir('demo', home)
    initProfile(dir, ['not-a-bundle'])
    expect(() => loadProfile('t', 'demo', anchor, home)).toThrow('declares no mnh.bundle')
  })
})

describe('composeEntries', () => {
  it('applies layers over an empty root and reports skipped patches', () => {
    const warnings: string[] = []
    const entries = composeEntries([
      [{ insert: [{ id: 'x', name: 'pkg-x', config: { a: 1 } }] }],
      [{ id: 'x', config: { a: 2 } }, { id: 'missing', config: {} }],
    ], message => warnings.push(message))
    expect(entries).toEqual([{ id: 'x', name: 'pkg-x', config: { a: 2 } }])
    expect(warnings.join('\n')).toContain('"missing"')
    // Default warn sink: skipped patches are silently dropped (boot repeats them).
    expect(composeEntries([[{ id: 'missing', config: {} }]])).toEqual([])
  })
})

describe('healProfilesModuleFallback', () => {
  it('quarantines the shared legacy fallback without deleting its contents', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const profiles = join(home, 'profiles')
    const legacy = join(profiles, 'node_modules')
    mkdirSync(legacy, { recursive: true })
    writeFileSync(join(legacy, 'keep.txt'), 'preserved\n')

    const { modulesDir } = fallbackPaths(healProfilesModuleFallback(anchor, home))

    expect(existsSync(legacy)).toBe(false)
    expect(readFileSync(join(profiles, '.module-fallback.legacy', 'keep.txt'), 'utf8')).toBe('preserved\n')
    expect(lstatSync(join(modulesDir, 'mnh-app')).isSymbolicLink()).toBe(true)
  })

  it('rejects file and junction legacy fallback roots', () => {
    const anchor = stageInstallation({})
    const fileHome = tmp()
    mkdirSync(join(fileHome, 'profiles'), { recursive: true })
    writeFileSync(join(fileHome, 'profiles', 'node_modules'), 'occupied\n')
    expect(() => { healProfilesModuleFallback(anchor, fileHome) }).toThrow('is not a real directory')

    const junctionHome = tmp()
    mkdirSync(join(junctionHome, 'profiles'), { recursive: true })
    symlinkSync(tmp(), join(junctionHome, 'profiles', 'node_modules'), 'junction')
    expect(() => { healProfilesModuleFallback(anchor, junctionHome) }).toThrow('is not a real directory')
  })

  it('fails loud when legacy and quarantined fallback directories both exist', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const profiles = join(home, 'profiles')
    mkdirSync(join(profiles, 'node_modules'), { recursive: true })
    mkdirSync(join(profiles, '.module-fallback.legacy'))
    expect(() => { healProfilesModuleFallback(anchor, home) }).toThrow('both')
  })

  it('links the app and bundle dependency surface, then reuses the derived stamp', () => {
    const anchor = stageInstallation({
      'bundle-a': { patch: '[]\n', deps: { 'dep-of-a': '0.0.0', 'ghost-dep': '0.0.0' } },
      'plain-lib': {},
    })
    // An app dependency that is declared but not installed: skipped, not fatal.
    const appManifest = JSON.parse(readFileSync(anchor, 'utf8')) as { dependencies: Record<string, string> }
    appManifest.dependencies['never-installed'] = '0.0.0'
    writeFileSync(anchor, JSON.stringify(appManifest))
    // dep-of-a lives in the installation's node_modules too.
    const modules = join(anchor, '..', 'node_modules')
    mkdirSync(join(modules, 'dep-of-a'), { recursive: true })
    writeFileSync(join(modules, 'dep-of-a', 'package.json'), JSON.stringify({ name: 'dep-of-a', version: '0.0.0' }))
    const home = tmp()
    const { modulesDir: fallback } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    // App deps, the bundle's own deps, and the bundle itself are linked; the
    // plain library is linked as an app dep (harmless), the app itself too.
    for (const name of ['bundle-a', 'plain-lib', 'dep-of-a', 'mnh-app']) {
      expect(lstatSync(join(fallback, name)).isSymbolicLink(), name).toBe(true)
    }
    const parse = vi.spyOn(JSON, 'parse')
    try {
      healProfilesModuleFallback(anchor, home)
      expect(parse).not.toHaveBeenCalled()
    } finally {
      parse.mockRestore()
    }
    const before = readlinkSync(join(fallback, 'dep-of-a'))
    expect(before).toContain('dep-of-a')
  })

  it('invalidates the stamp when the app manifest adds an installed dependency', () => {
    const anchor = stageInstallation({})
    const modules = join(anchor, '..', 'node_modules')
    const late = join(modules, 'late-package')
    mkdirSync(late, { recursive: true })
    writeFileSync(join(late, 'package.json'), JSON.stringify({ name: 'late-package', version: '0.0.0' }))
    const home = tmp()
    const { modulesDir: fallback } = fallbackPaths(healProfilesModuleFallback(anchor, home))

    writeFileSync(anchor, JSON.stringify({ name: 'mnh-app', dependencies: { 'late-package': '0.0.0' } }))
    healProfilesModuleFallback(anchor, home)
    expect(lstatSync(join(fallback, 'late-package')).isSymbolicLink()).toBe(true)
  })

  it('invalidates same-size app-manifest replacements with a preserved timestamp', () => {
    const anchor = stageInstallation({ 'pkg-a': {}, 'pkg-b': {} })
    const firstManifest = JSON.stringify({ name: 'mnh-app', dependencies: { 'pkg-a': '0.0.0' } })
    const secondManifest = JSON.stringify({ name: 'mnh-app', dependencies: { 'pkg-b': '0.0.0' } })
    expect(secondManifest).toHaveLength(firstManifest.length)
    writeFileSync(anchor, firstManifest)
    const fixedTime = new Date(1_700_000_000_000)
    utimesSync(anchor, fixedTime, fixedTime)
    const home = tmp()
    const { modulesDir: fallback } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const original = statSync(anchor)

    writeFileSync(anchor, secondManifest)
    utimesSync(anchor, fixedTime, fixedTime)
    expect(statSync(anchor)).toMatchObject({ size: original.size, mtimeMs: original.mtimeMs })
    healProfilesModuleFallback(anchor, home)

    expect(existsSync(join(fallback, 'pkg-a'))).toBe(false)
    expect(lstatSync(join(fallback, 'pkg-b')).isSymbolicLink()).toBe(true)
  })

  it('invalidates the stamp when the nearest installation lockfile changes', () => {
    const anchor = stageInstallation({ 'bundle-a': { patch: '[]\n' } })
    const modules = join(anchor, '..', 'node_modules')
    const late = join(modules, 'late-transitive')
    mkdirSync(late, { recursive: true })
    writeFileSync(join(late, 'package.json'), JSON.stringify({ name: 'late-transitive', version: '0.0.0' }))
    const home = tmp()
    const { modulesDir: fallback } = fallbackPaths(healProfilesModuleFallback(anchor, home))

    const bundleManifest = join(modules, 'bundle-a', 'package.json')
    writeFileSync(bundleManifest, JSON.stringify({
      name: 'bundle-a', version: '0.0.0', dependencies: { 'late-transitive': '0.0.0' },
      mnh: { bundle: { patch: './cordis.patch.yml' } },
    }))
    writeFileSync(join(anchor, '..', 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
    healProfilesModuleFallback(anchor, home)
    expect(lstatSync(join(fallback, 'late-transitive')).isSymbolicLink()).toBe(true)
  })

  it('hashes the nearest lockfile when its size and timestamp are preserved', () => {
    const anchor = stageInstallation({ 'bundle-a': { patch: '[]\n', deps: { 'dep-a': '0.0.0' } } })
    const modules = join(anchor, '..', 'node_modules')
    for (const name of ['dep-a', 'dep-b']) {
      mkdirSync(join(modules, name), { recursive: true })
      writeFileSync(join(modules, name, 'package.json'), JSON.stringify({ name, version: '0.0.0' }))
    }
    const lockfile = join(anchor, '..', 'pnpm-lock.yaml')
    writeFileSync(lockfile, 'alpha\n')
    const fixedTime = new Date(1_700_000_000_000)
    utimesSync(lockfile, fixedTime, fixedTime)
    const home = tmp()
    const { modulesDir: fallback } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const original = statSync(lockfile)

    writeFileSync(join(modules, 'bundle-a', 'package.json'), JSON.stringify({
      name: 'bundle-a', version: '0.0.0', dependencies: { 'dep-b': '0.0.0' },
      mnh: { bundle: { patch: './cordis.patch.yml' } },
    }))
    writeFileSync(lockfile, 'bravo\n')
    utimesSync(lockfile, fixedTime, fixedTime)
    expect(statSync(lockfile)).toMatchObject({ size: original.size, mtimeMs: original.mtimeMs })
    healProfilesModuleFallback(anchor, home)

    expect(existsSync(join(fallback, 'dep-a'))).toBe(false)
    expect(lstatSync(join(fallback, 'dep-b')).isSymbolicLink()).toBe(true)
  })

  it('repairs a deleted fallback link after the directory metadata changes', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const { modulesDir: fallback } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const appLink = join(fallback, 'mnh-app')
    unlinkSync(appLink)
    utimesSync(fallback, new Date(0), new Date(0))

    healProfilesModuleFallback(anchor, home)
    expect(lstatSync(appLink).isSymbolicLink()).toBe(true)
  })

  it('repairs a deleted scoped link after only its scope directory changes', () => {
    const anchor = stageInstallation({
      '@other/bundle': { patch: '[]\n' },
      '@scope/bundle': { patch: '[]\n' },
    })
    const home = tmp()
    const { modulesDir: fallback } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const scopeDir = join(fallback, '@scope')
    const link = join(scopeDir, 'bundle')
    unlinkSync(link)
    writeFileSync(join(scopeDir, 'keep.txt'), 'not a managed link\n')

    healProfilesModuleFallback(anchor, home)
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readFileSync(join(scopeDir, 'keep.txt'), 'utf8')).toBe('not a managed link\n')
  })

  it('isolates links when the installation anchor differs', () => {
    const first = stageInstallation({})
    const second = stageInstallation({})
    const home = tmp()
    const firstFallback = fallbackPaths(healProfilesModuleFallback(first, home)).modulesDir
    const secondFallback = fallbackPaths(healProfilesModuleFallback(second, home)).modulesDir
    expect(firstFallback).not.toBe(secondFallback)
    expect(readlinkSync(join(firstFallback, 'mnh-app'))).toBe(dirname(first))
    expect(readlinkSync(join(secondFallback, 'mnh-app'))).toBe(dirname(second))
  })

  it('keeps each installation dependency set in its own slot', () => {
    const first = stageInstallation({ 'first-only': {} })
    const second = stageInstallation({ 'second-only': {} })
    const home = tmp()
    const firstFallback = fallbackPaths(healProfilesModuleFallback(first, home)).modulesDir
    const secondFallback = fallbackPaths(healProfilesModuleFallback(second, home)).modulesDir
    expect(lstatSync(join(firstFallback, 'first-only')).isSymbolicLink()).toBe(true)
    expect(existsSync(join(firstFallback, 'second-only'))).toBe(false)
    expect(lstatSync(join(secondFallback, 'second-only')).isSymbolicLink()).toBe(true)
    expect(existsSync(join(secondFallback, 'first-only'))).toBe(false)
  })

  it('rebuilds a corrupt derived stamp', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const { stateDir } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const stampPath = join(stateDir, 'stamp.json')
    writeFileSync(stampPath, '{not-json\n')
    const parse = vi.spyOn(JSON, 'parse')
    try {
      healProfilesModuleFallback(anchor, home)
      expect(parse).toHaveBeenCalled()
    } finally {
      parse.mockRestore()
    }
    expect(JSON.parse(readFileSync(stampPath, 'utf8')))
      .toMatchObject({ version: 2, installAnchor: anchor })
  })

  it('removes an atomic-stamp temporary when replacement fails', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const { stateDir } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const stampPath = join(stateDir, 'stamp.json')
    unlinkSync(stampPath)
    mkdirSync(stampPath)
    expect(() => { healProfilesModuleFallback(anchor, home) }).toThrow()
    expect(readdirSync(stateDir).filter(name => name.endsWith('.tmp'))).toEqual([])
    expect(existsSync(join(stateDir, 'repair.lock'))).toBe(false)
  })

  it('records an installation with no node_modules directory', () => {
    const root = tmp()
    const appDir = join(root, 'app')
    mkdirSync(appDir)
    const anchor = join(appDir, 'package.json')
    writeFileSync(anchor, JSON.stringify({ name: 'standalone-app' }))
    const home = tmp()
    const { stateDir } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const stamp = JSON.parse(readFileSync(join(stateDir, 'stamp.json'), 'utf8')) as {
      installModules: unknown
    }
    expect(stamp.installModules).toBeNull()
  })

  it('propagates non-absence failures while fingerprinting installation metadata', () => {
    const root = tmp()
    const appDir = join(root, 'app')
    mkdirSync(appDir)
    const anchor = join(appDir, 'package.json')
    writeFileSync(anchor, JSON.stringify({ name: 'broken-app' }))
    const modules = join(appDir, 'node_modules')
    symlinkSync(modules, modules, 'junction')
    expect(() => { healProfilesModuleFallback(anchor, tmp()) }).toThrow()
  })

  it('throws when a fallback entry is a real directory', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const { stateDir, modulesDir } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    unlinkSync(join(modulesDir, 'mnh-app'))
    mkdirSync(join(modulesDir, 'mnh-app'))
    unlinkSync(join(stateDir, 'stamp.json'))
    expect(() => { healProfilesModuleFallback(anchor, home) }).toThrow('is not a symlink')
    expect(existsSync(join(stateDir, 'repair.lock'))).toBe(false)
  })

  it('rejects a non-directory scope parent', () => {
    const anchor = stageInstallation({ '@scope/bundle': { patch: '[]\n' } })
    const home = tmp()
    const { stateDir, modulesDir: fallback } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    rmSync(join(fallback, '@scope'), { recursive: true })
    writeFileSync(join(fallback, '@scope'), 'occupied\n')
    unlinkSync(join(stateDir, 'stamp.json'))
    expect(() => { healProfilesModuleFallback(anchor, home) }).toThrow('not a real scope directory')
  })

  it('rejects a junction fallback root without touching its target', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const { modulesDir } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const target = tmp()
    const sentinelTarget = tmp()
    const sentinel = join(target, 'sentinel')
    symlinkSync(sentinelTarget, sentinel, 'junction')
    rmSync(modulesDir, { recursive: true })
    symlinkSync(target, modulesDir, 'junction')
    expect(() => { healProfilesModuleFallback(anchor, home) }).toThrow('not a real fallback module directory')
    expect(readlinkSync(sentinel)).toBe(sentinelTarget)
    expect(existsSync(join(target, 'mnh-app'))).toBe(false)
  })

  it('replaces a wrong symlink', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const { stateDir, modulesDir: fallback } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    unlinkSync(join(fallback, 'mnh-app'))
    symlinkSync(tmp(), join(fallback, 'mnh-app'), 'junction')
    unlinkSync(join(stateDir, 'stamp.json'))
    healProfilesModuleFallback(anchor, home)
    expect(readlinkSync(join(fallback, 'mnh-app'))).toContain('app')
  })

  it('waits for a process holding the repair lock', async () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const { stateDir, modulesDir } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const lock = join(stateDir, 'repair.lock')
    writeFileSync(lock, `${process.pid}\n`)
    const script = `
      import { unlinkSync } from 'node:fs'
      setTimeout(() => unlinkSync(${JSON.stringify(lock)}), 50)
    `
    const releaser = spawn(process.execPath, ['--input-type=module', '--eval', script], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    healProfilesModuleFallback(anchor, home)
    await waitForChild(releaser)
    expect(lstatSync(join(modulesDir, 'mnh-app')).isSymbolicLink()).toBe(true)
  })

  it('times out without removing another process lock', () => {
    const anchor = stageInstallation({})
    const home = tmp()
    const { stateDir } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    const lock = join(stateDir, 'repair.lock')
    writeFileSync(lock, `${process.pid}\n`)
    const now = vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(2_000)
    try {
      expect(() => { healProfilesModuleFallback(anchor, home) }).toThrow('timed out waiting')
      expect(readFileSync(lock, 'utf8')).toBe(`${process.pid}\n`)
    } finally {
      now.mockRestore()
      unlinkSync(lock)
    }
  })

  it('serializes two real processes repairing the same installation', async () => {
    const anchor = stageInstallation({ 'shared-package': {} })
    const home = tmp()
    const { stateDir, modulesDir } = fallbackPaths(healProfilesModuleFallback(anchor, home))
    unlinkSync(join(stateDir, 'stamp.json'))
    const lock = join(stateDir, 'repair.lock')
    writeFileSync(lock, `${process.pid}\n`)
    const firstResult = join(home, 'first.result')
    const secondResult = join(home, 'second.result')
    const firstChild = spawnHealer(anchor, home, firstResult)
    const secondChild = spawnHealer(anchor, home, secondResult)
    const firstDone = waitForChild(firstChild)
    const secondDone = waitForChild(secondChild)
    const releaser = spawn(process.execPath, ['--input-type=module', '--eval', `
      import { unlinkSync } from 'node:fs'
      setTimeout(() => unlinkSync(${JSON.stringify(lock)}), 50)
    `], { stdio: ['ignore', 'ignore', 'pipe'] })
    try {
      await Promise.all([firstDone, secondDone, waitForChild(releaser)])
    } finally {
      rmSync(lock, { force: true })
      firstChild.kill()
      secondChild.kill()
      releaser.kill()
    }
    expect(readFileSync(firstResult, 'utf8')).toBe(readFileSync(secondResult, 'utf8'))
    expect(lstatSync(join(modulesDir, 'shared-package')).isSymbolicLink()).toBe(true)
    expect(existsSync(join(stateDir, 'repair.lock'))).toBe(false)
  })

  it('lets two installations repair independent slots concurrently', async () => {
    const first = stageInstallation({ 'first-only': {} })
    const second = stageInstallation({ 'second-only': {} })
    const home = tmp()
    const firstResult = join(home, 'first.result')
    const secondResult = join(home, 'second.result')
    const firstChild = spawnHealer(first, home, firstResult)
    const secondChild = spawnHealer(second, home, secondResult)
    try {
      await Promise.all([waitForChild(firstChild), waitForChild(secondChild)])
    } finally {
      firstChild.kill()
      secondChild.kill()
    }
    const firstFallback = fallbackPaths(readFileSync(firstResult, 'utf8')).modulesDir
    const secondFallback = fallbackPaths(readFileSync(secondResult, 'utf8')).modulesDir
    expect(firstFallback).not.toBe(secondFallback)
    expect(lstatSync(join(firstFallback, 'first-only')).isSymbolicLink()).toBe(true)
    expect(lstatSync(join(secondFallback, 'second-only')).isSymbolicLink()).toBe(true)
  })
})
