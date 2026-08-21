/**
 * Structural secret redaction for settings values. `role('secret')` fields are
 * removed from a value before it crosses a wire boundary; a sidecar records
 * each schema-declared secret position and whether it currently holds a value,
 * so a configuration surface can render a write-only input without ever
 * receiving the secret itself. Schema rejections are rendered here too, for the
 * same reason: their own text quotes the value they rejected.
 * @module @aflydream/mnh-settings/redact
 */

import type z from '@deepseek-ai/schemastery'

/**
 * Minimal structural view of a live schemastery node. Only the relations the
 * redactor walks are named; everything else on the instance is ignored.
 */
interface SchemaNode {
  uid?: number
  type?: string
  meta?: { role?: unknown; default?: unknown }
  /** `object` properties, keyed by property name. */
  dict?: Record<string, SchemaNode>
  /** `dict`/`array` element schema. */
  inner?: SchemaNode
  /** `tuple`/`union`/`intersect` member schemas. */
  list?: SchemaNode[]
  /** `dict` key schema; irrelevant to values but part of the schema graph. */
  sKey?: SchemaNode
  /** Deferred child builder for a `lazy` schema. */
  builder?: () => SchemaNode
}

/** One schema-declared secret position inside a redacted value. */
export interface RedactedSecret {
  /** Path from the section root to the removed field (concrete dict keys and array indexes included). */
  path: string[]
  /** Whether the field held a value before redaction. */
  set: boolean
}

/** A value with every `role('secret')` field removed, plus the removal record. */
export interface RedactedValue {
  /** Detached copy of the input with secret fields absent. */
  value: unknown
  /**
   * Every reachable secret position: object properties always (even unset, so
   * a form knows the slot exists), dict entries and array items only where the
   * value has them.
   */
  secrets: RedactedSecret[]
}

/** Whether a value is a plain data object the walker may recurse into. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Define an enumerable own data property without invoking `__proto__` setters. */
function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true })
}

interface RedactionState {
  secrets: RedactedSecret[]
  paths: Set<string>
}

/** Record one secret path once when several composite branches declare it. */
function recordSecret(state: RedactionState, path: string[], set: boolean): void {
  const key = JSON.stringify(path)
  if (state.paths.has(key)) return
  state.paths.add(key)
  state.secrets.push({ path, set })
}

/** Resolve and cache a lazy child with the metadata merge schemastery applies. */
function relationInner(node: SchemaNode): SchemaNode | undefined {
  if (node.type !== 'lazy' || node.inner?.type !== undefined || node.builder === undefined) return node.inner
  const inner = node.builder()
  inner.meta = { ...node.meta, ...inner.meta }
  node.inner = inner
  return inner
}

/**
 * Whether a node's kind can describe this value's JSON shape. `undefined` is
 * absence rather than a mismatch, so every kind accepts it and object-property
 * secret slots below a missing value stay enumerable. Relations resolve to the
 * kind that actually judges the value: a union accepts what any member does, an
 * intersection what every member does.
 */
function shapeAccepts(node: SchemaNode, value: unknown, seen = new Set<SchemaNode>()): boolean {
  if (value === undefined || seen.has(node)) return true
  seen.add(node)
  switch (node.type) {
    case 'object':
    case 'dict':
      return isRecord(value)
    case 'array':
    case 'tuple':
      return Array.isArray(value)
    case 'transform':
    case 'lazy': {
      const inner = relationInner(node)
      return inner === undefined || shapeAccepts(inner, value, seen)
    }
    case 'union':
      return (node.list ?? []).some(child => shapeAccepts(child, value, seen))
    case 'intersect':
      return (node.list ?? []).every(child => shapeAccepts(child, value, seen))
    default:
      return true
  }
}

/** Whether an unsupported schema node reaches a secret through its relation graph. */
function containsSecret(node: SchemaNode | undefined, seen = new Set<SchemaNode>()): boolean {
  if (node === undefined || seen.has(node)) return false
  seen.add(node)
  if (node.meta?.role === 'secret') return true
  const inner = relationInner(node)
  if (inner !== undefined && containsSecret(inner, seen)) return true
  if (node.sKey !== undefined && containsSecret(node.sKey, seen)) return true
  if (node.list?.some(child => containsSecret(child, seen)) === true) return true
  return Object.values(node.dict ?? {}).some(child => containsSecret(child, seen))
}

/**
 * Fail closed on a value this walker cannot explain: hide it when the schema
 * subtree at this path declares a secret anywhere, and record the position so
 * the omission is visible instead of silent.
 */
function hideUnexplained(node: SchemaNode, value: unknown, path: string[], state: RedactionState): unknown {
  if (!containsSecret(node)) return value
  recordSecret(state, path, value !== undefined)
  return undefined
}

function walk(
  node: SchemaNode | undefined,
  value: unknown,
  path: string[],
  state: RedactionState,
  ancestors: readonly { node: SchemaNode; value: unknown }[] = [],
): unknown {
  if (node === undefined) return value
  if (node.meta?.role === 'secret') {
    recordSecret(state, path, value !== undefined)
    return undefined
  }
  // Recursive lazy schemas may revisit one node with the same concrete value.
  // Valid JSON cannot contain a value cycle; this also bounds an absent
  // recursive property while still walking concrete descendants.
  if (ancestors.some(entry => entry.node === node && entry.value === value)) return value
  // A stored section reaches this walker unvalidated: `publish` keeps a
  // namespace's last good value when the document stops resolving, and
  // `describe` still reports that raw section. A value whose shape this node's
  // kind cannot describe is therefore unexplained, not merely uninteresting —
  // returning it verbatim is how a hand-edited secret escapes redaction.
  if (!shapeAccepts(node, value)) return hideUnexplained(node, value, path, state)
  const nextAncestors = [...ancestors, { node, value }]
  switch (node.type) {
    case 'object': {
      const properties = node.dict ?? {}
      const source = isRecord(value) ? value : undefined
      const rebuilt: Record<string, unknown> = {}
      if (source !== undefined) {
        for (const [key, entry] of Object.entries(source)) {
          if (Object.hasOwn(properties, key)) continue
          setOwn(rebuilt, key, entry)
        }
      }
      for (const [key, child] of Object.entries(properties)) {
        const entry = source !== undefined && Object.hasOwn(source, key) ? source[key] : undefined
        const stripped = walk(child, entry, [...path, key], state, nextAncestors)
        if (stripped !== undefined) setOwn(rebuilt, key, stripped)
      }
      return source === undefined && Object.keys(rebuilt).length === 0 ? value : rebuilt
    }
    case 'dict': {
      if (!isRecord(value)) return value
      const rebuilt: Record<string, unknown> = {}
      for (const [key, entry] of Object.entries(value)) {
        const stripped = walk(node.inner, entry, [...path, key], state, nextAncestors)
        if (stripped !== undefined) setOwn(rebuilt, key, stripped)
      }
      return rebuilt
    }
    case 'array': {
      if (!Array.isArray(value)) return value
      return value.map((entry, index) => walk(node.inner, entry, [...path, String(index)], state, nextAncestors))
    }
    case 'tuple': {
      if (!Array.isArray(value)) return value
      return value.map((entry: unknown, index) => {
        const child = node.list?.[index]
        return child === undefined ? entry : walk(child, entry, [...path, String(index)], state, nextAncestors)
      })
    }
    case 'union':
    case 'intersect': {
      // A wire boundary cannot rely on choosing the same branch as a renderer.
      // Redact anything secret in any branch that could describe this value;
      // duplicate paths collapse. Branches whose kind cannot describe it are
      // skipped so a sibling that explains it is not over-redacted.
      return (node.list ?? [])
        .filter(child => shapeAccepts(child, value))
        .reduce((current, child) => walk(child, current, path, state, nextAncestors), value)
    }
    case 'transform':
    case 'lazy': {
      return walk(relationInner(node), value, path, state, nextAncestors)
    }
    default:
      // Custom schema kinds are extension points. If their relation graph
      // reaches a secret through semantics this walker does not understand,
      // hide the complete value at this path instead of returning it verbatim.
      return hideUnexplained(node, value, path, state)
  }
}

/** Traverse each live schema node once, including initialized lazy schemas. */
function schemaNodes(root: SchemaNode): SchemaNode[] {
  const nodes: SchemaNode[] = []
  const seen = new Set<SchemaNode>()
  const visit = (node: SchemaNode | undefined): void => {
    if (node === undefined || seen.has(node)) return
    seen.add(node)
    nodes.push(node)
    visit(relationInner(node))
    visit(node.sKey)
    node.list?.forEach(visit)
    Object.values(node.dict ?? {}).forEach(visit)
  }
  visit(root)
  return nodes
}

/**
 * Serialize a schema for a redacted descriptor without embedding secret defaults.
 * Defaults on parent containers are structurally redacted too, so an object
 * default cannot smuggle a child secret through the schema envelope.
 */
export function redactSecretSchema(schema: z<never>): unknown {
  // Serialization initializes lazy nodes and returns a detached refs envelope.
  const serialized = schema.toJSON() as unknown as { refs?: Record<string, { meta?: Record<string, unknown> }> }
  const refs = serialized.refs ?? {}
  for (const node of schemaNodes(schema as unknown as SchemaNode)) {
    if (node.uid === undefined || node.meta === undefined || !Object.hasOwn(node.meta, 'default')) continue
    const output = refs[String(node.uid)]
    if (output?.meta === undefined) continue
    if (node.meta.role === 'secret') {
      delete output.meta.default
      continue
    }
    const redacted = redactSecrets(node as unknown as z<never>, node.meta.default).value
    if (redacted === undefined) delete output.meta.default
    else output.meta.default = redacted
  }
  return serialized
}

/**
 * Remove every `role('secret')` field a schema declares from a value. The
 * walker follows object, dict, array, tuple, union, intersection, transform,
 * and lazy relations. Composite branches are combined conservatively: a path
 * declared secret by any branch that could describe the value is removed. The
 * walker fails closed wherever it cannot explain what it is looking at — an
 * unsupported custom schema kind, or a value whose shape the declared kind
 * rejects (a raw section reaches `describe` unvalidated) — by hiding the
 * complete value at that path and recording the position. The input is never
 * mutated.
 * @param schema - live schemastery schema describing the value.
 * @param value - the value to strip; `undefined` yields an empty record with
 *   object-property secret slots still enumerated.
 * @returns the stripped detached value and the ordered secret positions.
 */
export function redactSecrets(schema: z<never>, value: unknown): RedactedValue {
  const state: RedactionState = { secrets: [], paths: new Set() }
  const stripped = walk(schema as unknown as SchemaNode, value, [], state)
  return { value: stripped, secrets: state.secrets }
}

/** A schemastery rejection, whose structured position is safe and whose text is not. */
interface SchemaRejection extends Error {
  options?: { path?: readonly (string | number | symbol)[] }
}

function isSchemaRejection(error: unknown): error is SchemaRejection {
  return error instanceof Error && error.name === 'ValidationError'
}

/** `$`-rooted position, rendered the way schemastery prefixes its own messages. */
function jsonPath(path: readonly (string | number | symbol)[] | undefined): string {
  let rendered = '$'
  for (const segment of path ?? []) {
    rendered += typeof segment === 'number' ? `[${String(segment)}]` : `.${String(segment)}`
  }
  return rendered
}

/**
 * Render a settings-write rejection for a wire surface: the position it failed
 * at, never the value it rejected. Schemastery quotes the offending value in
 * its message (`expected string but got sk-live-...`), and the candidate a write
 * validates is the stored section merged with the caller's patch — so that value
 * can be a secret the caller never sent and must not receive back.
 *
 * Only a schema rejection is rewritten. A namespace owner's `validate()` message
 * is its own text about its own value and reaches the caller verbatim; an owner
 * on a wire-exposed namespace must not quote a secret in it.
 * @param error - the rejection thrown by a settings write.
 * @returns the wire-safe message, or `undefined` when the caller should keep its own.
 */
export function redactSettingsError(error: unknown): string | undefined {
  if (!isSchemaRejection(error)) return undefined
  return `the value at ${jsonPath(error.options?.path)} does not satisfy this namespace's schema`
}
