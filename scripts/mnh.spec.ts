import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveCommands } from './mnh.mjs'

describe('repository mnh launcher', () => {
  it('runs install, build, and the built web CLI for dev', () => {
    const commands = resolveCommands(['dev', '--port', '3090'], { npm_execpath: 'pnpm.cjs' })

    expect(commands).toEqual([
      {
        label: 'Installing workspace dependencies',
        command: process.execPath,
        args: ['pnpm.cjs', 'install'],
      },
      {
        label: 'Building MiNeko Herness',
        command: process.execPath,
        args: ['pnpm.cjs', 'run', 'build'],
      },
      {
        label: 'Starting MiNeko Herness Web',
        command: process.execPath,
        args: ['apps/cli/lib/bin.js', 'web', '--port', '3090'],
      },
    ])
  })

  it('keeps existing source CLI invocations unchanged', () => {
    expect(resolveCommands(['web', '--port', '3090'])).toEqual([{
      command: process.execPath,
      args: ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'web', '--port', '3090'],
    }])
  })

  it('provides the short desktop script through the Electron launcher', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(manifest.scripts.desktop).toBe('node scripts/mnh.mjs desktop')
    expect(resolveCommands(['desktop'])).toEqual([{
      command: process.execPath,
      args: ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'desktop'],
    }])
  })

  it('fails loud when dev is not launched through pnpm', () => {
    expect(() => resolveCommands(['dev'], {}))
      .toThrow('pnpm mnh dev must be launched through pnpm')
  })
})
