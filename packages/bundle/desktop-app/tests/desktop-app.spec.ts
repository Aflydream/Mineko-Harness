/** Desktop profile product closure: model APIs and their client controls. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface Manifest {
  dependencies?: Record<string, string>
}

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

function manifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest
}

describe('mnh-desktop-app bundle', () => {
  it('ships the API model adapter, Models settings, and per-model selection controls', () => {
    const desktop = manifest(resolve(packageRoot, 'package.json'))
    const web = manifest(resolve(packageRoot, '..', 'web-app', 'package.json'))
    const baseRoot = resolve(packageRoot, '..', 'base')
    const base = manifest(resolve(baseRoot, 'package.json'))
    const basePatch = readFileSync(resolve(baseRoot, 'cordis.patch.yml'), 'utf8')
    const desktopPatch = readFileSync(resolve(packageRoot, 'cordis.patch.yml'), 'utf8')

    expect(desktop.dependencies).toHaveProperty('@aflydream/mnh-web-app')
    expect(web.dependencies).toHaveProperty('@aflydream/mnh-client-ui-settings-models')
    expect(web.dependencies).toHaveProperty('@aflydream/mnh-client-ui-model-selection')
    expect(base.dependencies).toHaveProperty('@aflydream/mnh-llm-pi-ai')
    expect(basePatch).toMatch(/id: llm-pi-ai\s+name: '@aflydream\/mnh-llm-pi-ai'/)
    expect(desktopPatch).toMatch(/id: modules\s+inject: \[\]/)
  })
})
