/** Generate Host Remote declarations before the aggregate TypeScript check. */

import { resolve } from 'node:path'
import { emitHostRemoteArtifacts } from '../packages/typert/generator/src/tsdown-plugin.ts'

emitHostRemoteArtifacts(resolve(import.meta.dirname, '..'))
