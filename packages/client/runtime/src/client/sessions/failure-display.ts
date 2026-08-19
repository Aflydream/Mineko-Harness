/** Stable wire code duplicated here so the client stays platform-pure. */
const CONTEXT_WINDOW_EXCEEDED_CODE = 'CONTEXT_WINDOW_EXCEEDED'

/** Provider-native context-limit and input-truncation vocabulary safe to match on the wire. */
const CONTEXT_FAILURE_PATTERNS = [
  new RegExp(
    String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]`
      + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`,
    'i',
  ),
  /\b(?:maximum|max)(?:\s+(?:allowed|supported))?\s+context\s+(?:length|window)\b/i,
  new RegExp(
    String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?`
      + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?`
      + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`,
    'i',
  ),
  new RegExp(
    String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}`
      + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}`
      + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`,
    'i',
  ),
  /\b(?:prompt|input|messages?)\s+(?:is\s+|are\s+)?too\s+(?:long|large)\b/i,
  new RegExp(
    String.raw`\b(?:input|prompt|messages?)\b.{0,60}`
      + String.raw`\b(?:exceed(?:s|ed)?|too\s+many)\b.{0,60}`
      + String.raw`\b(?:tokens?|token\s+limit|maximum\s+(?:number\s+of\s+)?tokens?)\b`,
    'i',
  ),
  new RegExp(
    String.raw`\b(?:context|conversation|history|message\s+history|prompt|input)\b.{0,40}`
      + String.raw`\b(?:truncat(?:ed|ion)|cut\s+off|trimmed|shorten(?:ed|ing)?)\b`,
    'i',
  ),
] as const

/**
 * Convert a durable failure into copy that is safe to expose in the GUI.
 * @param failure - Failure value preserved by the session event.
 * @returns Display-safe copy for client projections.
 */
export function displayFailureMessage(failure: unknown): string {
  if (failure === null || typeof failure !== 'object') return String(failure)
  const record = failure as { code?: unknown; message?: unknown }
  // Provider AUTH messages may echo a masked or partially preserved credential.
  // Keep the raw diagnostic in the session log, but never project it into UI state.
  if (record.code === 'AUTH') return 'API key is invalid'
  return typeof record.message === 'string' ? record.message : JSON.stringify(failure)
}

/**
 * Match canonical and provider-native context failures on the client too.
 * The Host normally canonicalizes these, but a custom Codex, Claude Code, or
 * compatible adapter may persist its original code beside the same message.
 * @param failure - durable failure value from a session event.
 * @returns whether the failure identifies an input-context limit or truncation.
 */
export function isContextWindowFailure(failure: unknown): boolean {
  if (failure === null || typeof failure !== 'object') return false
  const record = failure as { code?: unknown; message?: unknown }
  const code = typeof record.code === 'string' ? record.code : ''
  const message = typeof record.message === 'string' ? record.message : ''
  return code === CONTEXT_WINDOW_EXCEEDED_CODE
    || CONTEXT_FAILURE_PATTERNS.some(pattern => pattern.test(`${code} ${message}`))
}
