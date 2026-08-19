/**
 * Enforce the MIT license declaration for repository-owned MNH npm packages.
 * @module scripts/verify-mnh-package-licenses
 */

import { globSync, readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const MNH_PACKAGE_NAME = /^@aflydream\/mnh(?:-|$)/
/**
 * The Landlock launcher family carries the MNH name but ships under BSD
 * 3-Clause, matching the C source it derives from (`native/landlock-run/LICENSE`,
 * disclosed as first-party in THIRD_PARTY_NOTICES.md).
 */
const NON_MIT_DIRECTORY = 'native/landlock-run/'

/** Result of checking every MNH package reachable through the root workspace list. */
export interface MnhPackageLicenseReport {
  /** Number of MNH package manifests checked. */
  packageCount: number
  /** Repository-relative diagnostics for non-MIT declarations. */
  failures: string[]
}

function readManifest(root: string, file: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(resolve(root, file), 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`verify-mnh-package-licenses: ${file} must contain a JSON object.`)
  }
  return parsed as Record<string, unknown>
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry: unknown) => typeof entry === 'string')
}

function workspaceManifestPaths(root: string): string[] {
  const rootManifest = readManifest(root, 'package.json')
  const workspaces = rootManifest.workspaces
  if (!isStringArray(workspaces)) {
    throw new Error('verify-mnh-package-licenses: package.json workspaces must be a string array.')
  }

  const files = new Set(['package.json'])
  for (const pattern of workspaces) {
    for (const file of globSync(`${pattern}/package.json`, { cwd: root })) {
      files.add(file)
    }
  }
  return [...files].sort()
}

function printable(value: unknown): string {
  return value === undefined ? 'undefined' : JSON.stringify(value)
}

/**
 * Check every MNH npm package declared by the repository workspace.
 * @param root - absolute repository root containing the workspace package.json.
 * @returns the checked package count and every non-MIT declaration.
 */
export function inspectMnhPackageLicenses(root: string): MnhPackageLicenseReport {
  let packageCount = 0
  const failures: string[] = []

  for (const file of workspaceManifestPaths(root)) {
    const normalizedFile = file.split(sep).join('/')
    if (normalizedFile.startsWith(NON_MIT_DIRECTORY)) continue
    const manifest = readManifest(root, file)
    const name = manifest.name
    if (typeof name !== 'string' || !MNH_PACKAGE_NAME.test(name)) continue

    packageCount++
    if (manifest.license !== 'MIT') {
      failures.push(
        `${normalizedFile}: ${name} must declare "license": "MIT"; found ${printable(manifest.license)}.`,
      )
    }
  }

  return { packageCount, failures }
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  const report = inspectMnhPackageLicenses(ROOT)
  if (report.failures.length > 0) {
    process.stderr.write('verify-mnh-package-licenses: non-MIT MNH package declarations found:\n')
    for (const failure of report.failures) process.stderr.write(`  ${failure}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write(
      `verify-mnh-package-licenses: ${String(report.packageCount)} MNH package(s) checked; all declare MIT.\n`,
    )
  }
}
