/**
 * Fixed Codex one-shot subagent provider. Every accepted run starts a fresh
 * official `codex app-server --stdio` process in the delegating Session's
 * workspace and publishes only after an ephemeral thread exists.
 *
 * @module @aflydream/mnh-subagent-codex
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { MAX_TIMER_DELAY_MS } from '@aflydream/mnh-timeout'
import {
  assertPositiveFinite,
  NO_START_CAPABILITIES,
  resolveChildCwd,
  type ResolvedSubagentStartRequest,
  type SubagentCapabilities,
  type SubagentProvider,
} from '@aflydream/mnh-subagent'
import {
  DEFAULT_DISPOSE_GRACE_MS,
  startCodexRun,
  type CodexRunSpec,
} from './run.ts'

export const name = 'subagent-codex'
export const inject = ['subagents', 'subprocess']

/** Deployment-owned environment and process-release bound. */
export interface Config {
  /**
   * Explicit environment entries layered over the subprocess seam's
   * credential-scrubbed parent environment.
   */
  env?: Record<string, string>
  /** Grace in milliseconds for app-server process-tree termination. */
  disposeGraceMs?: number
}

export const Config: z<Config> = z.object({
  env: z.dict(z.string()).default({}),
  disposeGraceMs: z.number().default(DEFAULT_DISPOSE_GRACE_MS),
})

type ResolvedConfig = Required<Config>

class CodexProvider implements SubagentProvider {
  readonly name = 'codex'
  readonly capabilities: SubagentCapabilities = NO_START_CAPABILITIES
  readonly inheritsParentContext = false

  constructor(
    private readonly ctx: Context,
    private readonly config: ResolvedConfig,
  ) {}

  start(request: ResolvedSubagentStartRequest) {
    const parentCwd = request.parent.session.header.cwd
    if (parentCwd === undefined) {
      throw new Error(
        'subagent-codex: no working directory for the child — delegate from a parent session that has one',
      )
    }
    const spec: CodexRunSpec = {
      cwd: resolveChildCwd(
        'subagent-codex',
        undefined,
        parentCwd,
      ),
      env: this.config.env,
      disposeGraceMs: this.config.disposeGraceMs,
      spawn: spawnSpec => this.ctx.subprocess.spawn(spawnSpec),
      ...this.approver(request),
      onError: (error, stopReason) => {
        this.ctx.logger.warn(
          `subagent-codex: child run failed (${stopReason}): ${error.message}`,
        )
      },
    }
    return startCodexRun(request, spec)
  }

  /**
   * Route the child's approvals to the host's own approval surface, so a Codex
   * child can actually execute commands and change files under the same
   * question the user answers for every other tool. The question is asked on
   * behalf of the PARENT agent: the parent's turn is the one still open (it
   * called the delegation tool), and the audit pair belongs on the session the
   * user is watching.
   *
   * Without `ctx.approval` there is nobody to ask, so the field is omitted and
   * the wire keeps refusing — a composition that cannot ask must not grant.
   */
  private approver(request: ResolvedSubagentStartRequest): Pick<CodexRunSpec, 'approve'> {
    const approval = this.ctx.get('approval')
    if (approval === undefined) return {}
    return {
      approve: async (ask) => {
        const outcome = await approval.request({
          agent: request.parent,
          toolName: 'subagent_codex',
          reason: ask.kind === 'commandExecution'
            ? 'the Codex child wants to run a command'
            : 'the Codex child wants to change files',
          signal: request.signal,
        })
        // Only an explicit one-time allowance grants. `cancelled` additionally
        // interrupts the child's turn, because the question was withdrawn rather
        // than answered — continuing would leave it acting on a dead decision.
        if (outcome === 'allowed-once') return 'accept'
        return outcome === 'cancelled' ? 'cancel' : 'decline'
      },
    }
  }
}

/**
 * Register the fixed `codex` provider.
 * @param ctx - context carrying shared subagent and subprocess services.
 * @param config - explicit child environment and disposal grace.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  assertPositiveFinite(
    'subagent-codex',
    'disposeGraceMs',
    resolved.disposeGraceMs,
  )
  if (resolved.disposeGraceMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `subagent-codex: disposeGraceMs must be no greater than ${MAX_TIMER_DELAY_MS}`,
    )
  }
  ctx.subagents.registerProvider(new CodexProvider(ctx, resolved))
}
