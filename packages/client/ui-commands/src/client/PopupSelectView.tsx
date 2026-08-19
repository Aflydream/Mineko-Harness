/**
 * Official popupSelect shell: renders one session's PopupSelectController
 * store into the conversation.input.overlay anchor. Unlike the slash menu
 * (combobox — textarea keeps focus), this shell HOLDS focus while open: the
 * inner search input takes focus, plain typing filters the loaded options
 * locally, Enter/↑↓ drive the filtered highlight (scrolled into view), Escape
 * dismisses back to the composer, and ←→ keep the search input's native
 * caret. Any pointer interaction outside the box dismisses (the click's own
 * target takes focus). Closed state renders null; the overlay slot stays
 * mounted. The card height clamps to the space above the composer.
 */
import { useEffect, useRef, useState } from 'react'
import { useSyncExternalStore } from 'react'
import clsx from 'clsx'
import {
  IconCheckOutline16, RiskConfirmation, useAnchoredMaxHeight, useAnimatedPresence,
} from '@aflydream/mnh-client-ui-primitives'
import type { PropsLocale } from '@aflydream/mnh-client-ui-slots'
import { filterOptions } from './popup.ts'
import type { PopupSelectController } from './popup.ts'
import css from './PopupSelectView.module.css'

/** Design cap on the card height (same MenuDropdown family as the slash menu). */
const MAX_HEIGHT = 320

/** Injected business face of the popupSelect overlay entry. */
export interface PopupSelectInjected {
  /** The session's shell controller (state store + verbs; the view never touches the open-context type). */
  popup: PopupSelectController
}

/** Full shell props: injected face + the locale seat. */
export type PopupSelectViewProps = PopupSelectInjected & PropsLocale<'command'>

/**
 * Render the popupSelect shell overlay entry.
 * @param props - injected face: the session's shell controller; `t` rides the standard locale seat.
 * @returns the select card while open; null while closed.
 */
export function PopupSelectView({ popup, t }: PopupSelectViewProps) {
  const state = useSyncExternalStore(
    fn => popup.state.subscribe(fn),
    () => popup.state.getSnapshot(),
  )
  const visualStateRef = useRef(state)
  if (state.open) visualStateRef.current = state
  const visualState = state.open ? state : visualStateRef.current
  const confirmationRef = useRef(state.confirming?.confirmation)
  if (state.confirming !== null) confirmationRef.current = state.confirming.confirmation
  const [confirmationPresent, setConfirmationPresent] = useState(state.confirming !== null)
  const cardRef = useRef<HTMLDivElement>(null)
  const { present, closing, finishExit } = useAnimatedPresence(state.open, cardRef)
  const searchRef = useRef<HTMLInputElement>(null)
  // The card is bottom-anchored above the composer; clamp the design cap to
  // the space above it, re-measured on every store update.
  const maxHeight = useAnchoredMaxHeight(cardRef, MAX_HEIGHT, visualState)
  const active = state.open ? state.active : null

  useEffect(() => {
    if (state.confirming !== null) setConfirmationPresent(true)
  }, [state.confirming])

  // The search input keeps focus while arrows move a virtual highlight, so
  // the browser never scrolls the active row into view — do it here.
  useEffect(() => {
    if (active === null) return
    cardRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // Focus ownership: the search input grabs on open, and ANY outside
  // pointer interaction dismisses —
  // capture phase so a click landing anywhere else (textarea included)
  // closes the shell before its own handlers run; that click's target then
  // takes focus naturally, so no focusComposer here.
  useEffect(() => {
    if (!state.open || state.confirming !== null) return
    const onPointerDown = (ev: PointerEvent): void => {
      if (cardRef.current !== null && ev.target instanceof Node && cardRef.current.contains(ev.target)) return
      popup.dismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown, true) }
  }, [state.open, state.confirming, popup])

  // Focus the search input after it mounts (separate effect so the ref is populated).
  useEffect(() => {
    if (state.open && state.confirming === null) searchRef.current?.focus()
  }, [state.open, state.confirming])

  if (!present && !confirmationPresent) return null

  const rows = filterOptions(visualState.options, visualState.search)
  const confirmation = confirmationRef.current

  const onKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
    // ArrowLeft/ArrowRight fall through on purpose: the search input keeps
    // its native caret movement.
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault()
        popup.move(1)
        return
      case 'ArrowUp':
        ev.preventDefault()
        popup.move(-1)
        return
      case 'Enter':
        ev.preventDefault()
        void popup.select(state.active)
        return
      case 'Escape':
        ev.preventDefault()
        popup.dismiss({ focusComposer: true })
        return
      default:
    }
  }

  return (
    <>
      {visualState.confirming === null && (
        <div
          ref={cardRef}
          className={`${css.card}${closing ? ` ${css.closing}` : ''}`}
          style={{ maxHeight }}
          aria-label={t('overlay.aria', { command: String(visualState.command) })}
          aria-hidden={closing || undefined}
          onKeyDown={onKeyDown}
        >
          <input
            ref={searchRef}
            className={css.search}
            type="text"
            placeholder={t('search.placeholder')}
            aria-label={t('search.aria')}
            value={visualState.search}
            readOnly={visualState.submitting}
            onChange={(ev) => { popup.setSearch(ev.currentTarget.value) }}
          />
          {visualState.error !== null && (
            <div className={css.error} role="alert">
              <span className={css.errorText}>{visualState.error}</span>
              {visualState.status === 'failed' && (
                <button type="button" className={css.retry} onClick={() => { popup.retry() }}>{t('retry')}</button>
              )}
            </div>
          )}
          {visualState.status === 'pending' && <div className={css.status}>{t('status.loading')}</div>}
          {visualState.submitting && <div className={css.status}>{t('status.applying')}</div>}
          {visualState.status === 'ready' && rows.length === 0 && <div className={css.status}>{t('status.empty')}</div>}
          {visualState.status === 'ready' && (
            <div role="listbox" aria-label={t('listbox.aria', { command: String(visualState.command) })} className={css.viewport}>
              {rows.map((option, index) => (
                <div
                  key={option.id}
                  role="option"
                  aria-selected={index === state.active}
                  className={clsx(css.row, index === state.active && css.rowActive)}
                  // mousedown would race the document capture listener; the shell
                  // owns focus anyway, so a plain click (inside the card → no
                  // dismiss) works.
                  onClick={() => { void popup.select(index) }}
                  onMouseEnter={() => { popup.highlight(index) }}
                >
                  <span className={css.label}>{option.label}</span>
                  {option.detail !== undefined && <span className={css.detail}>{option.detail}</span>}
                  {option.active === true && <span className={css.check}><IconCheckOutline16 /></span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {confirmation !== undefined && (
        <RiskConfirmation
          open={state.open && state.confirming !== null}
          title={confirmation.title}
          description={confirmation.description}
          acknowledgeLabel={confirmation.acknowledgeLabel}
          cancelLabel={confirmation.cancelLabel}
          confirmLabel={confirmation.confirmLabel}
          acknowledged={visualState.acknowledged}
          onAcknowledgedChange={(value) => { popup.acknowledge(value) }}
          onCancel={() => { popup.cancelConfirmation() }}
          onConfirm={() => { void popup.confirm() }}
          onClosed={() => {
            setConfirmationPresent(false)
            finishExit()
          }}
        />
      )}
    </>
  )
}
