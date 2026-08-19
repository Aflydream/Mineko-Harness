/** Resolve and validate metadata for one Windows desktop release. */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/**
 * Read the release version, validate its tag, and extract its changelog section.
 * @param {{ root?: string, eventName: string, refName: string }} options - Repository and GitHub event metadata.
 * @returns {{ version: string, tag: string, artifactName: string, bundleName: string, releaseTitle: string, prerelease: boolean, notes: string }} Validated release metadata.
 */
export function prepareDesktopRelease({ root = repositoryRoot, eventName, refName }) {
  if (eventName !== 'push' && eventName !== 'workflow_dispatch') {
    throw new Error(`desktop release does not accept GitHub event ${JSON.stringify(eventName)}`)
  }

  const manifests = [
    ['package.json', readManifestVersion(root, 'package.json')],
    ['apps/cli/package.json', readManifestVersion(root, 'apps/cli/package.json')],
    ['apps/desktop/package.json', readManifestVersion(root, 'apps/desktop/package.json')],
  ]
  const version = manifests[0][1]
  const mismatches = manifests.filter(([, candidate]) => candidate !== version)
  if (mismatches.length > 0) {
    throw new Error(`desktop release versions must match:\n${manifests.map(([path, candidate]) => `${path}: ${candidate}`).join('\n')}`)
  }
  if (!versionPattern.test(version)) {
    throw new Error(`desktop release version is not valid semver: ${version}`)
  }

  const tag = `v${version}`
  if (eventName === 'push' && refName !== tag) {
    throw new Error(`desktop release tag must be ${tag}, got ${refName || '(empty)'}`)
  }

  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8')
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const heading = new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}\\r?$`, 'gm')
  const matches = [...changelog.matchAll(heading)]
  if (matches.length !== 1) {
    throw new Error(`CHANGELOG.md must contain exactly one dated ## [${version}] release heading`)
  }
  const start = matches[0].index
  const rest = changelog.slice(start + matches[0][0].length)
  const nextHeading = /^## \[/m.exec(rest)
  const end = nextHeading === null ? changelog.length : start + matches[0][0].length + nextHeading.index
  const changelogSection = `${changelog.slice(start, end).trim()}\n`
  if (!/^### /m.test(changelogSection)) {
    throw new Error(`CHANGELOG.md release ${version} must contain at least one ### section`)
  }

  const notes = formatReleaseNotes({ version, changelogSection })

  return {
    version,
    tag,
    artifactName: `MiNeko-Herness-Setup-${version}.exe`,
    bundleName: `mineko-herness-windows-${version}`,
    releaseTitle: `MiNeko Herness v${version}`,
    prerelease: version.includes('-'),
    notes,
  }
}

/**
 * Give the GitHub Release a stable, scannable layout while keeping the
 * versioned changelog section as the source of truth for product changes.
 * @param options - release version and extracted changelog section.
 * @returns the Markdown body written to the GitHub Release.
 */
function formatReleaseNotes({ version, changelogSection }) {
  const lines = changelogSection.trim().split(/\r?\n/)
  const heading = lines.shift() ?? ''
  const releaseDate = /^## \[[^\]]+\] - (.+)$/.exec(heading)?.[1]
  const changeLines = lines
  const changes = changeLines.join('\n').trim()
  return [
    '> Make Everything Happen',
    '>',
    `> MiNeko Herness v${version} · Windows x64`,
    '',
    '## What changed',
    '',
    `Released on ${releaseDate ?? 'the date recorded in CHANGELOG.md'}.`,
    '',
    changes,
    '',
    '## Downloads',
    '',
    '| File | Description |',
    '| --- | --- |',
    `| \`MiNeko-Herness-Setup-${version}.exe\` | Windows x64 installer |`,
    '| `SHA256SUMS` | SHA-256 checksum for the installer |',
    '',
    'The installer is unsigned unless the repository has configured its Authenticode signing secrets.',
    '',
  ].join('\n')
}

/** Read one package manifest's required version field. */
function readManifestVersion(root, relativePath) {
  const manifest = JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'))
  if (typeof manifest.version !== 'string' || manifest.version === '') {
    throw new Error(`${relativePath} must declare a non-empty string version`)
  }
  return manifest.version
}

/** Parse the two output paths accepted by the workflow entry point. */
function parseArguments(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index]
    const value = args[index + 1]
    if ((option !== '--notes-out' && option !== '--github-output') || value === undefined) {
      throw new Error('usage: desktop-release.mjs --notes-out <path> --github-output <path>')
    }
    values.set(option, value)
  }
  if (values.size !== 2 || !values.has('--notes-out') || !values.has('--github-output')) {
    throw new Error('usage: desktop-release.mjs --notes-out <path> --github-output <path>')
  }
  return { notesOut: values.get('--notes-out'), githubOutput: values.get('--github-output') }
}

/** Validate metadata and write the workflow outputs consumed by later jobs. */
function main() {
  const { notesOut, githubOutput } = parseArguments(process.argv.slice(2))
  const eventName = process.env.GITHUB_EVENT_NAME ?? ''
  const refName = process.env.GITHUB_REF_NAME ?? ''
  const release = prepareDesktopRelease({ eventName, refName })

  mkdirSync(dirname(notesOut), { recursive: true })
  writeFileSync(notesOut, release.notes)
  appendFileSync(githubOutput, [
    `version=${release.version}`,
    `tag=${release.tag}`,
    `artifact_name=${release.artifactName}`,
    `bundle_name=${release.bundleName}`,
    `release_title=${release.releaseTitle}`,
    `prerelease=${String(release.prerelease)}`,
    '',
  ].join('\n'))
  console.log(`desktop release: ${release.tag}, ${release.artifactName}`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
