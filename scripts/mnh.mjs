#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

/**
 * Build the child-process sequence for a repository `pnpm mnh` invocation.
 * @param {readonly string[]} args - Arguments following `pnpm mnh`.
 * @param {NodeJS.ProcessEnv} env - Environment containing pnpm's executable path.
 * @returns {{ label?: string, command: string, args: string[] }[]} Ordered commands.
 */
export function resolveCommands(args, env = process.env) {
  if (args[0] !== 'dev') {
    return [{
      command: process.execPath,
      args: ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', ...args],
    }]
  }

  const pnpmEntry = env.npm_execpath
  if (pnpmEntry === undefined || pnpmEntry === '') {
    throw new Error('pnpm mnh dev must be launched through pnpm so the package-manager entry point is available')
  }

  const webArgs = args.slice(1)
  return [
    {
      label: 'Installing workspace dependencies',
      command: process.execPath,
      args: [pnpmEntry, 'install'],
    },
    {
      label: 'Building MiNeko Harness',
      command: process.execPath,
      args: [pnpmEntry, 'run', 'build'],
    },
    {
      label: 'Starting MiNeko Harness Web',
      command: process.execPath,
      args: ['apps/cli/lib/bin.js', 'web', ...webArgs],
    },
  ]
}

/**
 * Run the repository launcher and return its process exit code.
 * @param {readonly string[]} args - Arguments following `pnpm mnh`.
 * @returns {number} Zero after every child succeeds, otherwise the first failure code.
 */
export function run(args) {
  let commands
  try {
    commands = resolveCommands(args)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }

  for (const step of commands) {
    if (step.label !== undefined) console.log(`\n[mnh] ${step.label}...`)
    const result = spawnSync(step.command, step.args, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    })
    if (result.error !== undefined) {
      console.error(`[mnh] ${result.error.message}`)
      return 1
    }
    if (result.signal !== null) {
      console.error(`[mnh] Child process stopped by ${result.signal}`)
      return 1
    }
    if (result.status !== 0) return result.status ?? 1
  }
  return 0
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = run(process.argv.slice(2))
}
