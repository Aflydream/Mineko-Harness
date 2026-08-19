// Modal: controlled full-viewport dialog (create-workspace and similar).
// The overlay portals to this document's body so ancestor stacking contexts
// cannot leave sticky page controls above the mask. This is still an in-page
// WebUI dialog; it never creates or targets another browser/native window.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { IconCloseOutline16 } from './icons/index.tsx'
import css from './Modal.module.css'

interface ModalPresentation {
  title: string
  closeLabel: string
  description: string | undefined
  children: ReactNode
  footer: ReactNode
  className: string | undefined
  contentClassName: string | undefined
  headless: boolean
}

/**
 * Render a centered modal over a blurred page mask.
 * @param props.open - whether the dialog is showing.
 * @param props.onClose - Escape or mask click.
 * @param props.onClosed - optional notification after the closing portal unmounts.
 * @param props.title - dialog heading (aria-label in every mode).
 * @param props.closeLabel - accessible close-button label.
 * @param props.description - optional supporting sentence under the title.
 * @param props.children - body (inputs, etc.).
 * @param props.footer - action row (Cancel / Create).
 * @param props.contentClassName - optional class for a scrollable content region.
 * @param props.headless - render children directly in the card (no default
 * header/close/body chrome) for dialogs whose figma frame owns its own
 * header structure; mask, card, Escape, and aria-label remain.
 * A controlled close retains the overlay until its exit animation ends;
 * its last open presentation stays stable even when the owner clears payload
 * state at close request time. Reduced-motion clients unmount it immediately.
 * @returns null after closing settles; otherwise the overlay tree.
 */
export function Modal({
  open, onClose, onClosed, title, closeLabel = 'Close', description, children, footer, className, contentClassName, headless = false,
}: {
  open: boolean
  onClose: () => void
  onClosed?: (() => void) | undefined
  title: string
  closeLabel?: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
  headless?: boolean
}) {
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>(() => open ? 'open' : 'closed')
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const currentPresentation: ModalPresentation = {
    title,
    closeLabel,
    description,
    children,
    footer,
    className,
    contentClassName,
    headless,
  }
  const retainedPresentation = useRef(currentPresentation)
  if (open) retainedPresentation.current = currentPresentation
  const presentation = open ? currentPresentation : retainedPresentation.current

  useLayoutEffect(() => {
    if (open) {
      setPhase('open')
      return
    }
    if (phase === 'closed') return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('closed')
      onClosed?.()
      return
    }
    setPhase('closing')
  }, [onClosed, open, phase])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open, onClose])

  useLayoutEffect(() => {
    const element = dialogRef.current
    if (phase !== 'closing' || element === null) return
    const finish = (event: AnimationEvent): void => {
      if (event.target !== element || open) return
      setPhase('closed')
      onClosed?.()
    }
    element.addEventListener('animationend', finish)
    return () => { element.removeEventListener('animationend', finish) }
  }, [onClosed, open, phase])

  if (phase === 'closed') return null

  return createPortal((
    <div className={clsx(css.root, phase === 'closing' && css.closing)} role="presentation">
      <div className={css.mask} aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className={clsx(css.dialog, presentation.className)}
        role="dialog"
        aria-modal="true"
        aria-label={presentation.title}
      >
        {presentation.headless
          ? presentation.children
          : (
            <>
              <div className={clsx(css.content, presentation.contentClassName)}>
                <div className={css.header}>
                  <h2 className={css.title}>{presentation.title}</h2>
                  <button type="button" className={css.close} aria-label={presentation.closeLabel} onClick={onClose}>
                    <IconCloseOutline16 size={14} />
                  </button>
                </div>
                {presentation.description !== undefined && presentation.description !== '' && (
                  <p className={css.description}>{presentation.description}</p>
                )}
                {presentation.children !== undefined && <div className={css.body}>{presentation.children}</div>}
              </div>
              {presentation.footer !== undefined && <div className={css.footer}>{presentation.footer}</div>}
            </>
          )}
      </div>
    </div>
  ), document.body)
}
