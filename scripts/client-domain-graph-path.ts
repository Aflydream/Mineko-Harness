/**
 * Resolve a relative module specifier without erasing traversal above the
 * client directory. Preserved leading `..` segments let the caller hand
 * package-root imports to the package-level graph verifier.
 * @param fromDir - slash-normalized directory relative to `src/client`.
 * @param spec - relative module specifier.
 * @returns slash-normalized path relative to `src/client`.
 */
export function resolveClientRelative(fromDir: string, spec: string): string {
  const parts = fromDir === '' ? [] : fromDir.split('/')
  for (const segment of spec.split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') {
      if (parts.length === 0 || parts.at(-1) === '..') parts.push('..')
      else parts.pop()
      continue
    }
    parts.push(segment)
  }
  return parts.join('/')
}
