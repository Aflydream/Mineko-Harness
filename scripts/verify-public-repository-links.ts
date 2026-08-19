/** Reject tracked files that reference an unavailable legacy repository. */

import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const unavailableOwner = ['deepseek', 'ai'].join('-')
const unavailableRepositoryName = ['deepseek', 'harness', 'sdk'].join('-')
const unavailableRepository = `${unavailableOwner}/${unavailableRepositoryName}`
const archivedAgentNotePrefix = '.agents/notes/archived/'

const namedReferenceCharacters: Readonly<Record<string, string>> = {
  hyphen: '-',
  sol: '/',
}

/** Normalize source spellings that render or decode to repository separators. */
function canonicalReferenceText(source: string): string {
  return source
    .replaceAll('\\/', '/')
    .replace(/\\u(0023|002d|002f)/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/%(23|2d|2f)/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(?:(\d+)|x([\da-f]+));/gi, (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      const code = Number.parseInt(decimal ?? hexadecimal ?? '', decimal === undefined ? 16 : 10)
      return code === 35 || code === 45 || code === 47 ? String.fromCodePoint(code) : entity
    })
    .replace(/&(hyphen|num|sol);/gi, (entity, name: string) => namedReferenceCharacters[name.toLowerCase()] ?? entity)
    .normalize('NFKC')
    .toLowerCase()
}

/** One tracked reference to the unavailable repository. */
export interface UnavailableRepositoryReference {
  /** Repository-relative file path. */
  file: string
  /** One-based source line. */
  line: number
}

/**
 * Locate unavailable-repository references in one active text file.
 * @param file - Repository-relative path used in diagnostics.
 * @param source - Text to inspect.
 * @returns every matching source line, excluding frozen archived Agent Notes.
 */
export function findUnavailableRepositoryReferences(file: string, source: string): UnavailableRepositoryReference[] {
  if (file.startsWith(archivedAgentNotePrefix)) return []

  const references: UnavailableRepositoryReference[] = []
  for (const [index, line] of source.split('\n').entries()) {
    const canonicalLine = canonicalReferenceText(line)
    if (canonicalLine.includes(unavailableRepository)) references.push({ file, line: index + 1 })
  }
  return references
}

function trackedFiles(repoRoot: string): string[] {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\0')
      .filter(file => file !== '')
  } catch {
    // Source archives and desktop workspaces may omit `.git`. Scan the
    // repository tree in that case, excluding generated and dependency trees
    // that cannot be part of the published source set.
    const ignoredDirectories = new Set([
      '.agents', '.cache', '.codex_tmp', '.dist', '.generated', '.git',
      '.pnpm-store', 'coverage', 'lib', 'node_modules', 'vendor',
    ])
    const files: string[] = []
    // This archive fallback deliberately stays independent from the website
    // fixture: it has a wider exclusion set and a different root normalizer.
    /* jscpd:ignore-start */
    function visit(directory: string): void {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
        const absolute = join(directory, entry.name)
        if (entry.isDirectory()) visit(absolute)
        else files.push(relative(repoRoot, absolute).split(sep).join('/'))
      }
    }
    /* jscpd:ignore-end */
    visit(repoRoot)
    return files
  }
}

function scanRepository(repoRoot: string): UnavailableRepositoryReference[] {
  const references: UnavailableRepositoryReference[] = []
  for (const file of trackedFiles(repoRoot)) {
    const path = resolve(repoRoot, file)
    if (!existsSync(path)) continue
    const stat = lstatSync(path)
    if (!stat.isFile() && !stat.isSymbolicLink()) continue
    const source = stat.isSymbolicLink() ? readlinkSync(path) : readFileSync(path, 'utf8')
    if (source.includes('\0')) continue
    references.push(...findUnavailableRepositoryReferences(file, source))
  }
  return references
}

const invokedPath = process.argv[1]
const isMain = invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href
if (isMain) {
  const references = scanRepository(root)
  if (references.length === 0) {
    console.log('verify-public-repository-links: tracked files reference no unavailable repository.')
  } else {
    console.error('verify-public-repository-links: unavailable repository references found:')
    for (const reference of references) console.error(`  ${reference.file}:${String(reference.line)}`)
    process.exitCode = 1
  }
}
