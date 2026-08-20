#!/usr/bin/env node

/** Build the native WebView2 shell when needed, then enter `mnh desktop`. */

import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from '../../../scripts/mnh.mjs'

const scriptRoot = dirname(fileURLToPath(import.meta.url))
const desktopRoot = resolve(scriptRoot, '..')
const nativeManifest = join(desktopRoot, 'native', 'Cargo.toml')
const nativeExecutable = join(desktopRoot, 'native', 'target', 'release', 'MiNekoHarness.exe')

/** Ensure the current Rust sources have produced the native desktop executable. */
export async function ensureNativeWindowsRuntime() {
  if (process.platform !== 'win32') {
    throw new Error('the MiNeko Harness native desktop development runtime supports Windows only')
  }
  await runChild('cargo', ['build', '--manifest-path', nativeManifest, '--release'])
  await access(nativeExecutable)
  return nativeExecutable
}

async function runChild(command, args) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: desktopRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', rejectRun)
    child.once('exit', (code, signal) => {
      if (signal !== null) rejectRun(new Error(`native desktop build exited from signal ${signal}`))
      else if (code !== 0) rejectRun(new Error(`native desktop build exited with code ${String(code)}`))
      else resolveRun()
    })
  })
}

async function main() {
  process.env.MNH_DESKTOP_NATIVE_EXECUTABLE = await ensureNativeWindowsRuntime()
  process.exitCode = run(['desktop', ...process.argv.slice(2)])
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
