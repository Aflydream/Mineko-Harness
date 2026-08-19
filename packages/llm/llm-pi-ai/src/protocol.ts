/**
 * Wire protocols available to hand-declared pi-ai routes.
 *
 * This module contains only configuration vocabulary. Protocol implementations
 * stay in `provider.ts`, which the adapter loads when a pi-ai route first
 * streams instead of during application boot.
 *
 * @module mnh-llm-pi-ai/protocol
 */

/** Supported protocol identifiers, in configuration-surface order. */
const PROTOCOLS = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
] as const

/** One protocol a configured route can name. */
export type SupportedProtocol = typeof PROTOCOLS[number]

/**
 * Every wire protocol a configured route may name, most-reached first.
 * @returns the supported protocol identifiers.
 */
export function supportedProtocols(): readonly string[] {
  return PROTOCOLS
}

/**
 * Test whether a value names a supported configured-route protocol.
 * @param value - protocol identifier to test.
 * @returns whether the protocol has a runtime implementation.
 */
export function isSupportedProtocol(value: string): value is SupportedProtocol {
  return (PROTOCOLS as readonly string[]).includes(value)
}
