/** Prepare the versioned manifests for a manually approved desktop release. */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const manifestPaths = ['package.json', 'apps/cli/package.json', 'apps/desktop/package.json']
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/**
 * Update the three manifests after validating the human-authored changelog section.
 *
 * The changelog is intentionally a precondition rather than generated text: the
 * person who dispatches the release remains responsible for writing human-readable
 * release notes before the version is promoted.
 *
 * @param {{ root?: string, version: string }} options - Repository and target version.
 * @returns {{ version: string, changedPaths: string[] }} The prepared version metadata.
 */
export function prepareDesktopVersion({ root = repositoryRoot, version }) {
  if (!versionPattern.test(version)) {
    throw new Error(`desktop release version must be semantic version text without a leading v: ${version}`)
  }

  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8')
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const heading = new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}\\r?$`, 'gm')
  const matches = [...changelog.matchAll(heading)]
  if (matches.length !== 1) {
    throw new Error(`CHANGELOG.md must contain exactly one dated ## [${version}] release heading before dispatch`)
  }

  const start = matches[0].index
  const rest = changelog.slice(start + matches[0][0].length)
  const nextHeading = /^## \[/m.exec(rest)
  const end = nextHeading === null ? changelog.length : start + matches[0][0].length + nextHeading.index
  const changelogSection = changelog.slice(start, end)
  if (!/^### /m.test(changelogSection)) {
    throw new Error(`CHANGELOG.md release ${version} must contain at least one ### section before dispatch`)
  }

  const manifests = manifestPaths.map((relativePath) => {
    const path = resolve(root, relativePath)
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    if (typeof manifest.version !== 'string' || manifest.version === '') {
      throw new Error(`${relativePath} must declare a non-empty string version`)
    }
    manifest.version = version
    return { path, relativePath, manifest }
  })

  for (const { path, manifest } of manifests) {
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  return { version, changedPaths: manifests.map(({ relativePath }) => relativePath) }
}

function parseVersion(args) {
  if (args.length !== 2 || args[0] !== '--version' || args[1] === '') {
    throw new Error('usage: prepare-desktop-version.mjs --version <x.y.z[-prerelease]>')
  }
  return args[1]
}

function main() {
  const release = prepareDesktopVersion({ version: parseVersion(process.argv.slice(2)) })
  console.log(`desktop version prepared: ${release.version}`)
  console.log(`updated: ${release.changedPaths.join(', ')}`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
