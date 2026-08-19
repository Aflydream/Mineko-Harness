import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { CallId } from '@aflydream/mnh-llm'
import { Session, SessionId } from '@aflydream/mnh-session'
import AgentRegistry, { Inbox } from '@aflydream/mnh-agent'
import type { Agent } from '@aflydream/mnh-agent'
import SystemPrompt from '@aflydream/mnh-system-prompt'
import ToolRuntime from '@aflydream/mnh-tools'
import TerminalSessionService from '@aflydream/mnh-terminal'
import SandboxProvider from '@aflydream/mnh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@aflydream/mnh-sandbox'
import SandboxPolicyService from '@aflydream/mnh-sandbox-policy'
import LocalSubprocessRuntime from '@aflydream/mnh-subprocess-local'
import * as TerminalLocal from '@aflydream/mnh-terminal-bash'
import * as ToolPty from '@aflydream/mnh-tool-terminal'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class PassthroughSandbox extends SandboxProvider {
  confine(argv: readonly string[], _policy: SandboxPolicy): ConfinedArgv {
    return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
  }
}

function agent(ctx: Context): Agent {
  const scope = ctx.plugin(() => {})
  const id = SessionId('pty-loader-agent')
  const session = Session.create(id)
  const value: Agent = {
    id, options: {}, session, inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {}, steer: () => {}, inject: () => {}, cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function resultText(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

const suite = process.platform === 'linux' || process.platform === 'darwin' ? describe : describe.skip

suite('terminal real Loader composition through cordis.yml', () => {
  it('boots cordis.yml and preserves shell state across real tool calls', async () => {
    root = await mkdtemp(join(tmpdir(), 'mnh-pty-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@aflydream/mnh-agent'",
      "- name: '@aflydream/mnh-system-prompt'",
      "- name: '@aflydream/mnh-tools'",
      "- name: '@aflydream/mnh-terminal'",
      "- name: '@aflydream/mnh-test-sandbox'",
      "- name: '@aflydream/mnh-sandbox-policy'",
      '  config:',
      '    mode: danger-full-access',
      `    workspaceRoot: ${JSON.stringify(root)}`,
      "- name: '@aflydream/mnh-subprocess-local'",
      "- name: '@aflydream/mnh-terminal-bash'",
      '  config:',
      '    pollIntervalMs: 10',
      '    exactProbeAfterMs: 20',
      '    idleSilenceMs: 250',
      '    handoffGraceMs: 250',
      '    timeoutMs: 2000',
      '    disposeGraceMs: 500',
      "- name: '@aflydream/mnh-tool-terminal'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@aflydream/mnh-agent', AgentRegistry],
      ['@aflydream/mnh-system-prompt', SystemPrompt],
      ['@aflydream/mnh-tools', ToolRuntime],
      ['@aflydream/mnh-terminal', TerminalSessionService],
      ['@aflydream/mnh-test-sandbox', PassthroughSandbox],
      ['@aflydream/mnh-sandbox-policy', SandboxPolicyService],
      ['@aflydream/mnh-subprocess-local', LocalSubprocessRuntime],
      ['@aflydream/mnh-terminal-bash', TerminalLocal],
      ['@aflydream/mnh-tool-terminal', ToolPty],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    const owner = agent(context)
    const signal = new AbortController().signal
    const spawn = await context.tools.execute({
      signal, callId: CallId('spawn'), name: 'terminal_open', arguments: { type: 'shell', name: 'main', cwd: root }, agent: owner,
    })
    expect(resultText(spawn)).toContain('started terminal session pty-1 (main)')

    await context.tools.execute({
      signal, callId: CallId('state'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'export KEEP=loader; cd /' }, agent: owner,
    })
    const read = await context.tools.execute({
      signal, callId: CallId('read'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'printf "cwd=%s keep=%s\\n" "$PWD" "$KEEP"' }, agent: owner,
    })
    expect(resultText(read)).toContain('cwd=/ keep=loader')
    expect(context.terminals.list(owner)).toHaveLength(1)
  }, 15_000)
})
