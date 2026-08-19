import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['lib/types/main.js', 'lib/types/launcher.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: { neverBundle: ['electron'] },
  },
  {
    entry: ['lib/types/preload.js'],
    outDir: 'lib',
    format: ['cjs'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: true,
    dts: false,
    clean: false,
    deps: { neverBundle: ['electron'] },
  },
])
