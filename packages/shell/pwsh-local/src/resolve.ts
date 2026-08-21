/**
 * PowerShell executable resolution, dependency-free so non-package consumers
 * (the repository's coverage-gate probe in `vitest.config.ts`) can share the
 * ONE resolution definition with the executor and its suites — a probe that
 * resolved differently from the code under test could exempt a file whose
 * suites actually run.
 *
 * @module @aflydream/mnh-pwsh-local/resolve
 */

import { lstatSync } from 'node:fs'
import { join } from 'node:path'
// Type-only, so this module stays runtime-dependency-free for the coverage-gate probe.
import type { ShellDialect } from '@aflydream/mnh-shell'

/**
 * Well-known Windows PowerShell install locations plus PATH entries, newest
 * first. Explicitly parameterized (env) so resolution is a pure function of
 * its inputs on every platform.
 * @param env - the environment to probe; defaults to the process environment.
 * @returns candidate `pwsh` executable paths in resolution order.
 */
export function candidatePwshPaths(env: NodeJS.ProcessEnv = process.env): string[] {
  const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
  const systemRoot = env.SystemRoot ?? 'C:\\Windows'
  const candidates = [
    join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
  ]
  // Microsoft Store installs (and any user-added location) live on PATH;
  // entries may carry surrounding quotes from `setx`-style definitions.
  for (const entry of (env.PATH ?? '').split(';')) {
    const trimmed = entry.trim().replace(/^"|"$/g, '')
    if (trimmed.length === 0) continue
    candidates.push(join(trimmed, 'pwsh.exe'))
  }
  // Windows PowerShell 5.1 remains the last-resort fallback on legacy hosts.
  candidates.push(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'))
  return candidates
}

/**
 * Name the PowerShell dialect a resolved executable runs. The two editions
 * live at distinguishable names by construction: Windows ships 5.1 only as
 * `powershell.exe`, and PowerShell 7+ only as `pwsh.exe` (or bare `pwsh` on
 * PATH). A configured path under neither name is unnameable — the caller must
 * then stay dialect-neutral rather than guess, because guessing 7 on a 5.1
 * host is exactly the failure this function exists to prevent.
 * @param resolvedPath - the executable {@link resolvePwshPath} produced.
 * @returns the dialect, or `undefined` when the name does not identify one.
 */
export function detectPowerShellDialect(resolvedPath: string): ShellDialect | undefined {
  // Compare the basename only: the same executable is reached through the
  // well-known absolute paths, a PATH entry, and a bare command name.
  const name = resolvedPath.replace(/^.*[\\/]/, '').toLowerCase()
  if (name === 'powershell' || name === 'powershell.exe') return 'windows-powershell-5'
  if (name === 'pwsh' || name === 'pwsh.exe') return 'powershell-7'
  return undefined
}

/**
 * Whether a candidate can be spawned. lstat opens the entry itself instead of
 * following reparse points, so it sees the Store app execution alias where
 * stat hits the target's ACL (EACCES); Node reports that alias as a symlink
 * on current releases and as a plain file on older ones, and CreateProcess
 * resolves either shape. A real directory never matches.
 */
function candidateExists(candidate: string): boolean {
  try {
    const stat = lstatSync(candidate)
    return stat.isFile() || stat.isSymbolicLink()
  } catch {
    // ENOENT (the candidate vanished between listing and probing) is the only
    // expected failure; any other error names an unspawnable path, so false
    // is the safe answer for it too.
    return false
  }
}

/**
 * Resolve the pwsh executable this executor spawns.
 * @param configured - an explicit `pwshPath` config value, trusted as-is.
 * @param env - the environment to probe on Windows; defaults to the process environment.
 * @param platform - the platform to resolve for; defaults to the process platform.
 * @returns the first existing well-known location on Windows (PowerShell 7
 *   install, a PATH entry such as the Microsoft Store install, then Windows
 *   PowerShell 5.1), else `pwsh` for PATH resolution.
 */
export function resolvePwshPath(
  configured?: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (configured !== undefined && configured.length > 0) return configured
  if (platform === 'win32') {
    for (const candidate of candidatePwshPaths(env)) {
      if (candidateExists(candidate)) return candidate
    }
  }
  return 'pwsh'
}
