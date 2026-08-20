import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const DIST_ROOT = fileURLToPath(new URL('../dist', import.meta.url))

it('ships install metadata with the built web application', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('<link rel="manifest" href="/manifest.webmanifest" />')

  const manifest: unknown = JSON.parse(await readFile(join(DIST_ROOT, 'manifest.webmanifest'), 'utf8'))
  expect(manifest).toEqual({
    id: '/',
    name: 'MiNeko Harness',
    short_name: 'MNH',
    description: 'Plugin-based AI agent workspace',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#f9fafb',
    icons: [{
      src: '/logo.png',
      sizes: '1024x1024',
      type: 'image/png',
      purpose: 'any',
    }],
  })
})

it('ships the product logo used by the manifest and favicon', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('<link rel="icon" type="image/png" sizes="1024x1024" href="/logo.png" />')

  const logo = await readFile(join(DIST_ROOT, 'logo.png'))
  expect(logo.subarray(1, 4).toString('ascii')).toBe('PNG')
  expect(logo.readUInt32BE(16)).toBe(1024)
  expect(logo.readUInt32BE(20)).toBe(1024)
})
