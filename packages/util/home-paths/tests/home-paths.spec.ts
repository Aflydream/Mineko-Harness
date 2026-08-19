import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MNH_HOME_DISPLAY,
  MNH_HOME_DIR_NAME,
  canonicalizeWatchPath,
  defaultMnhHome,
  mnhHomeDisplay,
  mnhHomePath,
  expandHomePath,
  resolveMnhHome,
} from '@aflydream/mnh-home-paths'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('mnh path helpers', () => {
  it('owns the shared default MNH home directory name', () => {
    expect(MNH_HOME_DIR_NAME).toBe('.mnh')
    expect(DEFAULT_MNH_HOME_DISPLAY).toBe('~/.mnh')
    expect(defaultMnhHome()).toBe(join(homedir(), '.mnh'))
  })

  it('expands tilde paths without changing non-tilde paths', () => {
    expect(expandHomePath('~')).toBe(homedir())
    expect(expandHomePath('~/.mnh')).toBe(join(homedir(), '.mnh'))
    expect(expandHomePath('~\\.mnh')).toBe(join(homedir(), '.mnh'))
    expect(expandHomePath('/tmp/.mnh')).toBe('/tmp/.mnh')
    expect(expandHomePath('~other/.mnh')).toBe('~other/.mnh')
  })

  it('resolves explicit path before MNH_HOME and the default', () => {
    const envHome = join(homedir(), 'env-mnh')

    expect(resolveMnhHome('/tmp/explicit-mnh', { MNH_HOME: '~/env-mnh' })).toBe(resolve('/tmp/explicit-mnh'))
    expect(resolveMnhHome(undefined, { MNH_HOME: '~/env-mnh' })).toBe(envHome)
    expect(resolveMnhHome(undefined, {})).toBe(defaultMnhHome())
  })

  it('treats an empty or whitespace-only MNH_HOME as unset', () => {
    expect(resolveMnhHome(undefined, { MNH_HOME: '' })).toBe(defaultMnhHome())
    expect(resolveMnhHome(undefined, { MNH_HOME: '   ' })).toBe(defaultMnhHome())
  })

  it('joins child segments onto the resolved MNH_HOME', () => {
    vi.stubEnv('MNH_HOME', '~/env-mnh')
    expect(mnhHomePath()).toBe(join(homedir(), 'env-mnh'))
    expect(mnhHomePath('storages', 'cache')).toBe(join(homedir(), 'env-mnh', 'storages', 'cache'))
  })

  it('labels a resolved home by whether it is the default root', () => {
    expect(mnhHomeDisplay(resolve(defaultMnhHome()))).toBe('~/.mnh')
    expect(mnhHomeDisplay('/some/other/root')).toBe('$MNH_HOME')
  })

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mnh-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
      await expect(canonicalizeWatchPath(join(alias, 'later', 'config.yml'))).resolves.toBe(
        join(await realpath(target), 'later', 'config.yml'),
      )
      const file = join(root, 'file')
      await writeFile(file, 'not a directory')
      await expect(canonicalizeWatchPath(join(file, 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
