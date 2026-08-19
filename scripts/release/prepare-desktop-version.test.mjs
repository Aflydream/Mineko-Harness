import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { prepareDesktopVersion } from './prepare-desktop-version.mjs'

const roots = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

test('updates the root, CLI, and desktop versions after changelog validation', () => {
  const root = fixture()

  const release = prepareDesktopVersion({ root, version: '0.1.0' })

  assert.deepEqual(release, {
    version: '0.1.0',
    changedPaths: ['package.json', 'apps/cli/package.json', 'apps/desktop/package.json'],
  })
  for (const relativePath of release.changedPaths) {
    assert.equal(JSON.parse(readFileSync(join(root, relativePath), 'utf8')).version, '0.1.0')
  }
})

test('requires a human-authored changelog section before changing manifests', () => {
  const root = fixture()
  const before = readFileSync(join(root, 'package.json'), 'utf8')
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n')

  assert.throws(
    () => prepareDesktopVersion({ root, version: '0.1.0' }),
    /CHANGELOG\.md must contain exactly one dated/,
  )
  assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), before)
})

test('rejects a tag-style version input', () => {
  assert.throws(
    () => prepareDesktopVersion({ root: fixture(), version: 'v0.1.0' }),
    /without a leading v/,
  )
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'mnh-prepare-desktop-version-'))
  roots.push(root)
  mkdirSync(join(root, 'apps/cli'), { recursive: true })
  mkdirSync(join(root, 'apps/desktop'), { recursive: true })
  for (const relativePath of ['package.json', 'apps/cli/package.json', 'apps/desktop/package.json']) {
    writeFileSync(join(root, relativePath), `${JSON.stringify({ name: relativePath, version: '0.1.0-rc.5' }, null, 2)}\n`)
  }
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [0.1.0] - 2026-08-19\n\n### Changed\n\n- Windows release.\n')
  return root
}
