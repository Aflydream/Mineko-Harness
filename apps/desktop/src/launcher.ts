/** Node launcher for the Electron desktop runtime. */

import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

/** Desktop launcher options supplied by the `mnh desktop` command. */
export interface DesktopLaunchOptions {
  /** Patch overlays forwarded to the desktop profile. */
  patchFiles: readonly string[]
  /** Arguments passed to the desktop application after `--`. */
  args: readonly string[]
}

/** Electron executable and desktop main entry used by the source launcher. */
export interface DesktopElectronRuntime {
  /** Absolute path to Electron's executable. */
  executable: string
  /** Absolute path to the built desktop main process. */
  main: string
}

/**
 * Resolve the checked-out Electron executable and desktop main process.
 * @returns paths used by `mnh desktop`.
 */
export function desktopElectronRuntime(): DesktopElectronRuntime {
  const require = createRequire(new URL('../package.json', import.meta.url))
  const executable: unknown = require('electron')
  if (typeof executable !== 'string' || executable === '') {
    throw new Error('mnh desktop: Electron executable is unavailable')
  }
  return {
    executable,
    main: fileURLToPath(new URL('../lib/main.js', import.meta.url)),
  }
}

/**
 * Start the desktop profile in Electron's Node main process.
 * @param options - patch overlays and application arguments.
 * @returns the Electron process exit code.
 */
export async function launchDesktop(options: DesktopLaunchOptions): Promise<number> {
  const runtime = desktopElectronRuntime()
  await access(runtime.main).catch(() => {
    throw new Error('mnh desktop: built desktop entry is missing; run pnpm run build first')
  })
  const environment = { ...process.env }
  delete environment.ELECTRON_RUN_AS_NODE
  const desktop = spawn(runtime.executable, [
    runtime.main,
    ...options.patchFiles.flatMap(path => ['--mnh-patch', path]),
    '--',
    ...options.args,
  ], {
    stdio: 'inherit',
    env: environment,
    windowsHide: false,
  })
  return new Promise<number>((resolve, reject) => {
    desktop.once('error', reject)
    desktop.once('exit', (code, signal) => {
      if (signal !== null) reject(new Error(`mnh desktop: Electron exited from signal ${signal}`))
      else resolve(code ?? 1)
    })
  })
}
