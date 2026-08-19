import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { resolveCommands } from '../../../scripts/mnh.mjs'
import { desktopElectronRuntime } from '../../desktop/src/launcher.ts'

/**
 * Keyless smoke for SOURCE `mnh` execution: run `apps/cli/src/bin.ts`
 * with the exact production runtime vector (`node --import tsx/esm`, the
 * vector the root `mnh` script resolves to for every non-`dev` invocation)
 * and assert the required-config diagnostic. The Node compatibility matrix
 * runs this WHOLE file, so a Node release changing module hooks or TypeScript
 * handling breaks this gate instead of every developer's `pnpm mnh`; the
 * built-bin suite covers the published `lib/` entry, not this source chain.
 */

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const mnhSourceBin = 'apps/cli/src/bin.ts'

describe('mnh SOURCE launcher (node --import tsx/esm)', () => {
  it('launches the source CLI without building', async () => {
    const rootPackage = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8')) as {
      readonly scripts?: Record<string, string>
    }
    expect(rootPackage.scripts?.mnh).toBe('node scripts/mnh.mjs')
    // Both halves of the chain: the script reaches the launcher, and the
    // launcher hands ordinary invocations the vector this file then exercises.
    expect(resolveCommands(['--profile', 'headless'])).toEqual([{
      command: process.execPath,
      args: ['--import', 'tsx/esm', mnhSourceBin, '--profile', 'headless'],
    }])
  })

  it('selects the installed Electron executable and built desktop main', () => {
    const runtime = desktopElectronRuntime()
    expect(runtime.executable.toLowerCase()).toMatch(/electron\.exe$/u)
    expect(runtime.main).toBe(resolve(repoRoot, 'apps/desktop/lib/main.js'))
  })

  it('boots the source entry and requires a profile', async () => {
    const result = await execa(process.execPath, ['--import', 'tsx/esm', mnhSourceBin], {
      cwd: repoRoot,
      input: '',
      timeout: 25_000,
      killSignal: 'SIGKILL',
      reject: false,
    })
    if (result.timedOut) {
      throw new Error(`mnh source launch did not exit within 25s. stdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
    }
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('--profile <name> is required')
    expect(result.stdout).toBe('')
  }, 30_000)
})
