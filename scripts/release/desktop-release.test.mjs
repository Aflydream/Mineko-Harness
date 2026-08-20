import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { inflateSync } from 'node:zlib'
import * as yaml from 'js-yaml'
import { prepareDesktopRelease } from './desktop-release.mjs'

const roots = []
const repositoryRoot = join(import.meta.dirname, '../..')

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

test('prepares the exact tagged prerelease and its changelog section', () => {
  const root = fixture()
  const release = prepareDesktopRelease({ root, eventName: 'push', refName: 'v0.1.0-rc.5' })

  assert.deepEqual(release, {
    version: '0.1.0-rc.5',
    tag: 'v0.1.0-rc.5',
    artifactName: 'MiNeko-Harness-Setup-0.1.0-rc.5.exe',
    bundleName: 'mineko-harness-windows-0.1.0-rc.5',
    releaseTitle: 'MiNeko Harness v0.1.0-rc.5',
    prerelease: true,
    notes: '> Make Everything Happen\n>\n> MiNeko Harness v0.1.0-rc.5 · Windows x64\n\n## What changed\n\nReleased on 2026-08-17.\n\n### Added\n\n- Windows desktop.\n\n## Downloads\n\n| File | Description |\n| --- | --- |\n| `MiNeko-Harness-Setup-0.1.0-rc.5.exe` | Windows x64 installer |\n| `SHA256SUMS` | SHA-256 checksum for the installer |\n\nThe installer is unsigned unless the repository has configured its Authenticode signing secrets.\n',
  })
})

test('manual dispatch is a dry run from any branch', () => {
  const release = prepareDesktopRelease({ root: fixture(), eventName: 'workflow_dispatch', refName: 'feature/windows' })
  assert.equal(release.tag, 'v0.1.0-rc.5')
})

test('reusable workflow calls validate and publish the exact prepared tag', () => {
  const release = prepareDesktopRelease({ root: fixture(), eventName: 'workflow_call', refName: 'v0.1.0-rc.5' })
  assert.equal(release.tag, 'v0.1.0-rc.5')
  assert.equal(release.prerelease, true)
})

test('rejects a tag that does not exactly name the repository version', () => {
  assert.throws(
    () => prepareDesktopRelease({ root: fixture(), eventName: 'push', refName: 'desktop-v0.1.0-rc.5' }),
    /desktop release tag must be v0\.1\.0-rc\.5/,
  )
})

test('rejects divergent desktop runtime versions', () => {
  const root = fixture({ desktopVersion: '0.1.0-rc.4' })
  assert.throws(
    () => prepareDesktopRelease({ root, eventName: 'workflow_dispatch', refName: 'master' }),
    /desktop release versions must match/,
  )
})

test('rejects a release missing from the changelog', () => {
  const root = fixture({ changelog: '# Changelog\n\n## [0.1.0-rc.4] - 2026-08-16\n\n### Added\n\n- Older.\n' })
  assert.throws(
    () => prepareDesktopRelease({ root, eventName: 'workflow_dispatch', refName: 'master' }),
    /CHANGELOG\.md must contain exactly one dated/,
  )
})

test('keeps manual dispatch dry-run and tag publication artifact-first', () => {
  const workflow = yaml.load(readFile(join(repositoryRoot, '.github/workflows/desktop-release.yml')))
  const builder = yaml.load(readFile(join(repositoryRoot, 'apps/desktop/electron-builder.yml')))
  assert.deepEqual(workflow.on, {
    push: { tags: ['v*'] },
    workflow_dispatch: {
      inputs: {
        tag: {
          description: 'Existing release tag to recover, for example v0.1.0',
          required: false,
          type: 'string',
        },
        publish: {
          description: 'Publish the validated GitHub Release instead of a build-only dry run',
          required: false,
          default: false,
          type: 'boolean',
        },
      },
    },
    workflow_call: {
      inputs: {
        ref: {
          description: 'Git ref containing the prepared release',
          required: true,
          type: 'string',
        },
        tag: {
          description: 'Exact release tag, for example v0.1.0',
          required: true,
          type: 'string',
        },
        publish: {
          description: 'Publish the validated GitHub Release',
          required: true,
          type: 'boolean',
        },
      },
    },
  })
  assert.deepEqual(workflow.permissions, { contents: 'read' })
  assert.equal(workflow.jobs.build['runs-on'], 'windows-2025')
  assert.equal(
    workflow.jobs.release.if,
    "(github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')) || (inputs.publish == true && inputs.tag != '')",
  )
  assert.deepEqual(workflow.jobs.release.permissions, { contents: 'write' })
  assert.equal(workflow.jobs.release.needs, 'build')

  const buildSteps = workflow.jobs.build.steps
  const checkout = buildSteps.find(step => step.uses === 'actions/checkout@v6')
  assert.equal(checkout.with.ref, "${{ inputs.ref || inputs.tag || github.ref }}")
  const metadata = buildSteps.find(step => step.name === 'Resolve and verify desktop release metadata')
  assert.deepEqual(metadata.env, {
    MNH_RELEASE_EVENT_NAME: "${{ inputs.publish && 'workflow_call' || github.event_name }}",
    MNH_RELEASE_REF_NAME: '${{ inputs.tag || github.ref_name }}',
  })
  const packageStep = buildSteps.find(step => step.name === 'Package Windows installer')
  assert.equal(packageStep.run, 'pnpm --filter @aflydream/mnh-desktop run package:win')
  assert.deepEqual(packageStep.env, {
    CSC_LINK: '${{ secrets.WINDOWS_CSC_LINK }}',
    CSC_KEY_PASSWORD: '${{ secrets.WINDOWS_CSC_KEY_PASSWORD }}',
  })
  const installerSmoke = buildSteps.find(step => step.name === 'Smoke-test NSIS install and uninstall')
  assert.equal(installerSmoke.run, 'scripts/release/smoke-desktop-installer.ps1 -SetupPath "release/$env:ARTIFACT_NAME"')
  const installerSmokeScript = readFile(join(repositoryRoot, 'scripts/release/smoke-desktop-installer.ps1'))
  assert.match(installerSmokeScript, /Start-Process -FilePath \$setup/)
  assert.match(installerSmokeScript, /installRoot = Join-Path \$workingRoot 'install'/)
  assert.match(installerSmokeScript, /ArgumentList @\('\/S', "\/D=\$installRoot"\)/)
  assert.match(installerSmokeScript, /MiNekoHarness\.exe/)
  assert.match(installerSmokeScript, /resources\/app\.asar/)
  assert.match(installerSmokeScript, /Start-Process -FilePath \$application/)
  assert.match(installerSmokeScript, /AutomationElement/)
  assert.match(installerSmokeScript, /Get-NetTCPConnection -State Listen/)
  assert.match(installerSmokeScript, /CloseMainWindow/)
  assert.match(installerSmokeScript, /Uninstall\*\.exe/)
  assert.match(installerSmokeScript, /left application files behind/)
  assert.match(installerSmokeScript, /removed MiNeko Harness user data/)
  assert.ok(buildSteps.some(step => step.uses === 'actions/upload-artifact@v7'))

  const releaseSteps = workflow.jobs.release.steps
  assert.ok(releaseSteps.some(step => step.uses === 'actions/download-artifact@v8'))
  assert.ok(!releaseSteps.some(step => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@')))
  const publish = releaseSteps.find(step => step.name === 'Create GitHub Release')
  assert.equal(publish.env.GH_REPO, '${{ github.repository }}')
  assert.match(publish.run, /gh release create/)
  assert.match(publish.run, /dist\/SHA256SUMS/)
  assert.match(publish.run, /dist\/\$ARTIFACT_NAME/)

  assert.equal(builder.win.icon, 'mineko.ico')
  assert.equal(builder.appId, 'com.aflydream.minekoharness')
  assert.equal(builder.productName, 'MiNeko Harness')
  assert.equal(builder.win.executableName, 'MiNekoHarness')
  assert.equal(builder.nsis.shortcutName, 'MiNeko Harness')
  assert.ok(builder.extraResources.some(resource =>
    resource.from === 'mineko.ico' && resource.to === 'mineko.ico'))
  const staging = readFile(join(repositoryRoot, 'apps/desktop/scripts/stage-release.mjs'))
  assert.match(staging, /assets', 'mineko\.ico'/)
  assert.match(staging, /requiredFiles = \[[\s\S]*stagedIcon/)
  assert.match(staging, /process\.platform !== 'win32'/)
  assert.match(staging, /packageManager\.toLowerCase\(\)\.endsWith\('\.exe'\)/)
  assert.match(staging, /spawn\(command, commandArgs, \{/)

  const desktopMain = readFile(join(repositoryRoot, 'apps/desktop/src/main.ts'))
  assert.match(desktopMain, /process\.resourcesPath, 'mineko\.ico'/)
  assert.match(desktopMain, /APP_ROOT, 'assets\/mineko\.ico'/)
  assert.match(desktopMain, /title: DESKTOP_APP_NAME/)
  assert.match(desktopMain, /titleBarStyle: 'hidden'/)
  assert.match(desktopMain, /color: '#00000000'/)

  const desktopLogo = readFileSync(join(repositoryRoot, 'apps/desktop/assets/logo.png'))
  const webLogo = readFileSync(join(repositoryRoot, 'apps/web/public/logo.png'))
  assert.deepEqual(desktopLogo, webLogo)
  const alpha = pngAlpha(desktopLogo)
  assert.equal(alpha.center, 0)
  assert.equal(alpha.corner, 0)
  assert.ok(alpha.visible > 0, 'desktop logo must contain visible pixels')
  assert.ok(
    alpha.transparent > alpha.total / 2,
    'desktop logo must remain a borderless mark on a transparent background',
  )
  const desktopIcon = readFileSync(join(repositoryRoot, 'apps/desktop/assets/mineko.ico'))
  const iconEntries = icoEntries(desktopIcon)
  assert.deepEqual(iconEntries.map(entry => [entry.width, entry.height]), [
    [16, 16], [20, 20], [24, 24], [32, 32], [40, 40], [48, 48], [64, 64], [128, 128], [256, 256],
  ])
  for (const entry of iconEntries) {
    const frame = desktopIcon.subarray(entry.offset, entry.offset + entry.bytes)
    assert.equal(frame.subarray(1, 4).toString('ascii'), 'PNG', `ICO frame ${entry.width}x${entry.height} must be PNG encoded`)
    const frameAlpha = pngAlpha(frame)
    assert.deepEqual([frameAlpha.width, frameAlpha.height], [entry.width, entry.height])
    assert.equal(frameAlpha.corner, 0, `ICO frame ${entry.width}x${entry.height} must keep transparent corners`)
    assert.ok(frameAlpha.visible > 0, `ICO frame ${entry.width}x${entry.height} must contain the logo`)
  }
})

function icoEntries(ico) {
  assert.equal(ico.readUInt16LE(0), 0, 'desktop icon has an invalid ICO reserved field')
  assert.equal(ico.readUInt16LE(2), 1, 'desktop icon must be an icon resource')
  const count = ico.readUInt16LE(4)
  assert.equal(count, 9, 'desktop icon must include all configured Windows sizes')
  const entries = []
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16
    const width = ico[offset] === 0 ? 256 : ico[offset]
    const height = ico[offset + 1] === 0 ? 256 : ico[offset + 1]
    const bytes = ico.readUInt32LE(offset + 8)
    const resourceOffset = ico.readUInt32LE(offset + 12)
    assert.ok(resourceOffset + bytes <= ico.length, `ICO frame ${width}x${height} exceeds the file`)
    entries.push({ width, height, bytes, offset: resourceOffset })
  }
  return entries
}

function pngAlpha(png) {
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG')
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  assert.equal(png[24], 8, 'desktop logo must use 8-bit PNG channels')
  assert.equal(png[25], 6, 'desktop logo must use RGBA PNG pixels')
  assert.equal(png[28], 0, 'desktop logo must not use interlaced PNG rows')

  const idat = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    const type = png.subarray(offset + 4, offset + 8).toString('ascii')
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length))
    offset += 12 + length
  }
  const rows = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  assert.equal(rows.length, height * (stride + 1))
  let previous = new Uint8Array(width)
  let transparent = 0
  let visible = 0
  let corner = -1
  let center = -1
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (stride + 1)
    const filter = rows[rowOffset]
    assert.ok(filter <= 4, `desktop logo PNG uses unknown filter ${String(filter)}`)
    const current = new Uint8Array(width)
    for (let x = 0; x < width; x += 1) {
      const encoded = rows[rowOffset + 1 + x * 4 + 3]
      const left = x === 0 ? 0 : current[x - 1]
      const up = previous[x]
      const upLeft = x === 0 ? 0 : previous[x - 1]
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : paeth(left, up, upLeft)
      const alpha = (encoded + predictor) & 0xff
      current[x] = alpha
      if (alpha === 0) transparent += 1
      else visible += 1
      if (x === 0 && y === 0) corner = alpha
      if (x === Math.floor(width / 2) && y === Math.floor(height / 2)) center = alpha
    }
    previous = current
  }
  return { width, height, center, corner, transparent, visible, total: width * height }
}

function paeth(left, up, upLeft) {
  const prediction = left + up - upLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const upLeftDistance = Math.abs(prediction - upLeft)
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left
  if (upDistance <= upLeftDistance) return up
  return upLeft
}

function fixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mnh-desktop-release-'))
  roots.push(root)
  mkdirSync(join(root, 'apps/cli'), { recursive: true })
  mkdirSync(join(root, 'apps/desktop'), { recursive: true })
  writeManifest(join(root, 'package.json'), options.rootVersion ?? '0.1.0-rc.5')
  writeManifest(join(root, 'apps/cli/package.json'), options.cliVersion ?? '0.1.0-rc.5')
  writeManifest(join(root, 'apps/desktop/package.json'), options.desktopVersion ?? '0.1.0-rc.5')
  writeFileSync(join(root, 'CHANGELOG.md'), options.changelog ?? [
    '# Changelog',
    '',
    '## [0.1.0-rc.5] - 2026-08-17',
    '',
    '### Added',
    '',
    '- Windows desktop.',
    '',
    '## [0.1.0-rc.4] - 2026-08-16',
    '',
    '### Added',
    '',
    '- Older.',
    '',
  ].join('\n'))
  return root
}

function writeManifest(path, version) {
  writeFileSync(path, `${JSON.stringify({ version })}\n`)
}

function readFile(path) {
  return readFileSync(path, 'utf8')
}
