/** Prepare the complete production dependency tree consumed by electron-builder. */

import { spawn } from 'node:child_process'
import { copyFile, lstat, mkdir, opendir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptRoot = dirname(fileURLToPath(import.meta.url))
const desktopRoot = resolve(scriptRoot, '..')
const repositoryRoot = resolve(desktopRoot, '../..')
const releaseRoot = join(repositoryRoot, '.desktop-release')
const stageRoot = join(releaseRoot, 'app')
const iconSource = join(desktopRoot, 'assets', 'mineko.ico')
const stagedIcon = join(stageRoot, 'mineko.ico')
const packageManager = process.env.npm_execpath

if (process.platform !== 'win32') {
  throw new Error('desktop release staging supports Windows only')
}

if (packageManager === undefined || !packageManager.toLowerCase().includes('pnpm')) {
  throw new Error('desktop release staging must run through pnpm')
}

await rm(releaseRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
await mkdir(releaseRoot, { recursive: true })
await runPnpm([
  '--config.inject-workspace-packages=true',
  '--ignore-scripts',
  '--dir', repositoryRoot,
  '--filter', '@aflydream/mnh',
  'deploy', '--prod', stageRoot,
])

const deployedManifestPath = join(stageRoot, 'package.json')
const desktopManifestPath = join(desktopRoot, 'package.json')
const deployedManifest = JSON.parse(await readFile(deployedManifestPath, 'utf8'))
const desktopManifest = JSON.parse(await readFile(desktopManifestPath, 'utf8'))

if (deployedManifest.version !== desktopManifest.version) {
  throw new Error(`desktop release version mismatch: CLI ${String(deployedManifest.version)}, desktop ${String(desktopManifest.version)}`)
}

deployedManifest.main = 'release-main.mjs'
deployedManifest.private = true
deployedManifest.productName = 'MiNeko Harness'
deployedManifest.author = 'Aflydream'
delete deployedManifest.bin
delete deployedManifest.devDependencies
delete deployedManifest.publishConfig
delete deployedManifest.scripts

await copyFile(join(desktopRoot, 'build', 'release-main.mjs'), join(stageRoot, 'release-main.mjs'))
await copyFile(iconSource, stagedIcon)
await writeFile(deployedManifestPath, `${JSON.stringify(deployedManifest, null, 2)}\n`)
await verifyRuntimeClosure()

console.log(`Desktop release staged at ${stageRoot}`)

async function runPnpm(args) {
  await new Promise((resolveRun, rejectRun) => {
    const nativeExecutable = packageManager.toLowerCase().endsWith('.exe')
    const command = nativeExecutable ? packageManager : process.execPath
    const commandArgs = nativeExecutable ? args : [packageManager, ...args]
    const child = spawn(command, commandArgs, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: 'inherit',
    })
    child.once('error', rejectRun)
    child.once('exit', (code, signal) => {
      if (signal !== null) {
        rejectRun(new Error(`pnpm deploy exited from signal ${signal}`))
      } else if (code !== 0) {
        rejectRun(new Error(`pnpm deploy exited with code ${String(code)}`))
      } else {
        resolveRun()
      }
    })
  })
}

async function verifyRuntimeClosure() {
  await verifyContainedLinks(stageRoot)
  const stageRequire = createRequire(join(stageRoot, 'release-main.mjs'))
  const profileBootPath = join(stageRoot, 'lib', 'profile-boot.js')
  const rootDependencyPaths = Object.keys(deployedManifest.dependencies ?? {})
    .map(specifier => resolveStagedModule(stageRequire, specifier))
  const appBootPath = resolveStagedModule(stageRequire, '@aflydream/mnh-app-boot')
  const appBootRequire = createRequire(appBootPath)
  const groupPath = resolveStagedModule(appBootRequire, '@deepseek-ai/cordis-plugin-group')
  const desktopPackagePath = resolveStagedModule(stageRequire, '@aflydream/mnh-desktop/package.json')
  const desktopPackageRoot = dirname(desktopPackagePath)
  const desktopRequire = createRequire(desktopPackagePath)
  const basePackagePath = resolveStagedModule(stageRequire, '@aflydream/mnh-base/package.json')
  const subprocessPackagePath = resolveStagedModule(
    createRequire(basePackagePath), '@aflydream/mnh-subprocess-local/package.json',
  )
  const nodePtyPackagePath = resolveStagedModule(createRequire(subprocessPackagePath), 'node-pty/package.json')
  const nodePtyRoot = dirname(nodePtyPackagePath)

  const requiredFiles = [
    profileBootPath,
    stagedIcon,
    ...rootDependencyPaths,
    appBootPath,
    groupPath,
    join(desktopPackageRoot, 'lib', 'main.js'),
    join(desktopPackageRoot, 'lib', 'preload.cjs'),
    resolveStagedModule(desktopRequire, '@aflydream/mnh-web-frontend/dist/index.html'),
    join(nodePtyRoot, 'prebuilds', 'win32-x64', 'conpty.node'),
    join(nodePtyRoot, 'prebuilds', 'win32-x64', 'conpty_console_list.node'),
    join(nodePtyRoot, 'prebuilds', 'win32-x64', 'pty.node'),
    join(nodePtyRoot, 'prebuilds', 'win32-x64', 'conpty', 'OpenConsole.exe'),
    join(nodePtyRoot, 'prebuilds', 'win32-x64', 'conpty', 'conpty.dll'),
    join(nodePtyRoot, 'prebuilds', 'win32-x64', 'winpty-agent.exe'),
    join(nodePtyRoot, 'prebuilds', 'win32-x64', 'winpty.dll'),
  ]

  await Promise.all(requiredFiles.map(async path => {
    const details = await stat(path).catch(() => undefined)
    if (details === undefined || !details.isFile()) {
      throw new Error(`desktop release staging is missing ${path}`)
    }
  }))

  await import(pathToFileURL(appBootPath).href)
}

async function verifyContainedLinks(directory) {
  for await (const entry of await opendir(directory)) {
    const path = join(directory, entry.name)
    const details = await lstat(path)
    if (details.isSymbolicLink()) {
      assertInsideStage(path, await realpath(path))
    } else if (details.isDirectory()) {
      await verifyContainedLinks(path)
    }
  }
}

function resolveStagedModule(requireFromStage, specifier) {
  const path = requireFromStage.resolve(specifier)
  assertInsideStage(specifier, path)
  return path
}

function assertInsideStage(subject, path) {
  const relation = relative(stageRoot, path)
  if (relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new Error(`desktop release staging resolved ${subject} outside ${stageRoot}: ${path}`)
  }
}
