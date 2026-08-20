/**
 * Settings shell root: the sidebar-foot trigger row plus the centered modal
 * panel (figma 501:29947, 1080x700) with the section nav rail. The shell is
 * a pure composition face — every piece of text (trigger label, panel title,
 * close label, sections) arrives from registrants through slots; accessible
 * names resolve to that content (trigger: its own text; dialog:
 * aria-labelledby the title node; close: visually-hidden slot text). Modal
 * open state and the active section id are component-local viewing state;
 * opening measures the trigger so CSS can expand the panel from that point;
 * closing retains the modal until CSS returns it there.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  IconAgentPresetOutline16, IconCloseOutline16, IconDataOutline16,
  IconPersonalizationOutline16, IconSettingsOutline16,
} from '@aflydream/mnh-client-ui-primitives'
import type { SettingsRootComponentProps, SettingsSectionRow } from './shell-contract.ts'
import css from './SettingsRoot.module.css'

/** Nav glyph by section id; unknown ids fall back to the settings gear. */
function navIcon(id: string) {
  if (id === 'models') return <IconDataOutline16 className={css.navIcon} size={16} />
  if (id === 'agent-presets') return <IconAgentPresetOutline16 className={css.navIcon} size={16} />
  if (id === 'plugins') return <IconPersonalizationOutline16 className={css.navIcon} size={16} />
  return <IconSettingsOutline16 className={css.navIcon} size={16} />
}

type PanelProps = {
  rows: readonly SettingsSectionRow[]
  renderSlot: SettingsRootComponentProps['renderSlot']
  activeId: string | undefined
  closing: boolean
  origin: PanelOrigin
  onSelect: (id: string) => void
  onClose: () => void
  onClosed: () => void
}

type PanelOrigin = Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>

/**
 * The modal layer: full-viewport mask + centered panel. Close paths: the
 * header button, a mask click, and document-level Escape (mounted only while
 * open, so the listener lifetime is the panel's).
 */
function SettingsPanel({ rows, renderSlot, activeId, closing, origin, onSelect, onClose, onClosed }: PanelProps) {
  // Entries can unmount underneath the requested id, so the render-time
  // projection falls back to the first row when the id is gone.
  const active = rows.find(r => r.id === activeId)?.id ?? rows[0]?.id
  const titleId = useId()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [onClose])

  // Baseline focus management: entering the dialog lands on the close button.
  const closeButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { closeButton.current?.focus() }, [])

  const panel = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const element = panel.current
    if (element === null) return
    const target = element.getBoundingClientRect()
    if (target.width === 0 || target.height === 0) return
    const sourceCenterX = origin.left + origin.width / 2
    const sourceCenterY = origin.top + origin.height / 2
    const targetCenterX = target.left + target.width / 2
    const targetCenterY = target.top + target.height / 2
    element.style.setProperty('--settings-origin-x', `${sourceCenterX - targetCenterX}px`)
    element.style.setProperty('--settings-origin-y', `${sourceCenterY - targetCenterY}px`)
    element.style.setProperty('--settings-origin-scale-x', `${Math.max(origin.width / target.width, 0.01)}`)
    element.style.setProperty('--settings-origin-scale-y', `${Math.max(origin.height / target.height, 0.01)}`)
  }, [origin])

  useLayoutEffect(() => {
    const element = panel.current
    if (!closing || element === null) return
    const finish = (event: AnimationEvent): void => {
      if (event.target === element) onClosed()
    }
    element.addEventListener('animationend', finish)
    return () => { element.removeEventListener('animationend', finish) }
  }, [closing, onClosed])

  return (
    <div className={clsx(css.overlay, closing && css.closing)} role="presentation">
      <div className={css.mask} aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
        className={css.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <nav className={css.nav}>
          <div className={css.navTitle} id={titleId}>{renderSlot('settings.header', {})}</div>
          <div className={css.navList}>
            {rows.map(row => (
              <button
                key={row.id}
                type="button"
                className={clsx(css.navCell, row.id === active && css.active)}
                aria-current={row.id === active ? 'true' : undefined}
                onClick={() => { onSelect(row.id) }}
              >
                {navIcon(row.id)}
                <span className={css.navLabel}>{row.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className={css.content}>
          <div className={css.header}>
            <div className={css.actions}>{renderSlot('settings.action', {})}</div>
            <button ref={closeButton} type="button" className={css.close} onClick={onClose}>
              <IconCloseOutline16 size={14} />
              <span className={css.hiddenLabel}>{renderSlot('settings.close', {})}</span>
            </button>
          </div>
          <div className={css.options}>
            {active !== undefined && (
              <div key={active} className={css.sectionTransition}>
                {renderSlot('settings.section', { close: onClose }, { only: active })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Render the settings trigger and panel.
 * @param props - composed slot props (contract/slots.ts).
 * @returns the settings shell element tree.
 */
export function SettingsRoot(props: SettingsRootComponentProps) {
  const { wide, useSections, renderSlot } = props
  const [panelPhase, setPanelPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const [activeId, setActiveId] = useState<string | undefined>(undefined)
  const [panelOrigin, setPanelOrigin] = useState<PanelOrigin>({ left: 0, top: 0, width: 1, height: 1 })
  const trigger = useRef<HTMLButtonElement | null>(null)
  const openFromTrigger = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect()
    if (rect !== undefined) {
      setPanelOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    }
    setPanelPhase('open')
  }, [])
  const finishClose = useCallback(() => {
    setPanelPhase('closed')
    setActiveId(undefined)
    trigger.current?.focus()
  }, [])
  const close = useCallback(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishClose()
      return
    }
    setPanelPhase(phase => phase === 'closed' ? phase : 'closing')
  }, [finishClose])
  // The ledger tick keeps the nav rows fresh: registrants re-register with
  // freshly localized text on locale change, and the trigger/header/close
  // seats re-render through their own outlets' subscriptions.
  const rows = useSections(s => s)

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={clsx(css.trigger, !wide && css.rail)}
        aria-haspopup="dialog"
        aria-expanded={panelPhase !== 'closed'}
        onClick={openFromTrigger}
      >
        {renderSlot('settings.trigger', { wide })}
      </button>
      {panelPhase !== 'closed' && (
        <SettingsPanel
          rows={rows}
          renderSlot={renderSlot}
          activeId={activeId}
          closing={panelPhase === 'closing'}
          origin={panelOrigin}
          onSelect={setActiveId}
          onClose={close}
          onClosed={finishClose}
        />
      )}
    </>
  )
}
