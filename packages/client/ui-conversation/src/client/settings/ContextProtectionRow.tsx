/** General Settings row for provider-reported context truncation protection. */
import clsx from 'clsx'
import type { SnapshotStore } from '@aflydream/mnh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@aflydream/mnh-client-ui-slots'
import type { ConversationKey } from '../locales.ts'
import css from './ContextProtectionRow.module.css'

/** Registration-side preference face. */
export interface ContextProtectionRowInjected {
  hooks: {
    /** Persisted context-error protection preference. */
    preserveContext: SnapshotStore<boolean>
  }
  /** Change the context-error protection preference. */
  setPreserveContext: (preserve: boolean) => void
}

/** Full Settings-row props. */
export type ContextProtectionRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'conversation'>
  & InjectFace<ContextProtectionRowInjected>

/** Render the opt-in context-error protection switch. */
export function ContextProtectionRow({
  usePreserveContext, setPreserveContext, t,
}: ContextProtectionRowProps) {
  const enabled = usePreserveContext(value => value)
  const stateLabel: ConversationKey = enabled
    ? 'settings.contextProtection.enabled'
    : 'settings.contextProtection.disabled'

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('settings.contextProtection.title')}</div>
        <div className={css.desc}>{t('settings.contextProtection.description')}</div>
      </div>
      <button
        type="button"
        className={clsx(css.switch, enabled && css.enabled)}
        role="switch"
        aria-checked={enabled}
        aria-label={`${t('settings.contextProtection.title')}: ${t(stateLabel)}`}
        onClick={() => { setPreserveContext(!enabled) }}
      >
        <span className={css.thumb} />
      </button>
    </div>
  )
}
