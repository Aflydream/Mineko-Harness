/**
 * Type declarations for scripts/mnh.mjs repository launcher.
 */
export interface ResolvedCommand {
  label?: string
  command: string
  args: string[]
}

export function resolveCommands(
  args: readonly string[],
  env?: NodeJS.ProcessEnv,
): ResolvedCommand[]

export function run(args: readonly string[]): number
