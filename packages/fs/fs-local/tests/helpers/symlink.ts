/**
 * Shared platform probe: whether this session may create symlinks at all.
 *
 * Windows grants `SeCreateSymbolicLinkPrivilege` only to an elevated session or
 * one with Developer Mode enabled, so `symlink()` raises `EPERM` on an ordinary
 * developer box. A suite that plants a symlink to set up its subject then fails
 * for a reason that has nothing to do with the subject — and a whole package
 * reads as broken on the platform the product ships to. Skipping instead keeps
 * the signal honest: the case is unrunnable here, not failing.
 *
 * @module @aflydream/mnh-fs-local/tests/helpers/symlink
 */

import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Probed once at module load: creating a link is cheap, and the answer cannot
 * change within a run. A dangling target is fine — the privilege check happens
 * before the target is resolved, which is exactly the permission under test.
 */
export const canSymlink: boolean = (() => {
  const probe = mkdtempSync(join(tmpdir(), 'mnh-symlink-probe-'))
  try {
    symlinkSync(join(probe, 'target'), join(probe, 'link'))
    return true
  } catch {
    return false
  } finally {
    rmSync(probe, { recursive: true, force: true })
  }
})()
