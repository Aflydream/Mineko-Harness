import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { createPortal } from 'react-dom'
import { IconCloseOutline16 } from '@aflydream/mnh-client-ui-primitives'
import css from './ImageLightbox.module.css'

/** Lightbox strings the owner resolves from its own locale namespace. */
export interface ImageLightboxLabels {
  /** Accessible name of the preview dialog. */
  dialog: string
  /** Accessible label of the close control. */
  close: string
}

/**
 * Document-level original-image preview opened by clicking a thumbnail.
 * Escape, backdrop press, and the close control play the inverse entrance
 * motion before notifying the owner to unmount; reduced motion notifies it
 * immediately. Focus returns to the opener on unmount. Rendered through a body portal: an opener inside
 * a transformed or filtered ancestor would otherwise trap the fixed backdrop
 * in that ancestor's box instead of covering the viewport.
 *
 * @param props.src - the original image URL.
 * @param props.alt - the image's alt text.
 * @param props.labels - dialog and close-control strings.
 * @param props.onClose - dismiss callback owned by the opener.
 * @returns the modal preview dialog.
 */
export function ImageLightbox({ src, alt, labels, onClose }: {
  src: string
  alt: string
  labels: ImageLightboxLabels
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const [closing, setClosing] = useState(false)
  const requestClose = useCallback(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    setClosing(true)
  }, [onClose])

  useEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      restoreRef.current?.focus()
    }
  }, [requestClose])

  useLayoutEffect(() => {
    const element = imageRef.current
    if (!closing || element === null) return
    const finish = (event: AnimationEvent): void => {
      if (event.target === element) onClose()
    }
    element.addEventListener('animationend', finish)
    return () => { element.removeEventListener('animationend', finish) }
  }, [closing, onClose])

  return createPortal(
    <div
      className={clsx(css.backdrop, closing && css.closing)}
      role="dialog"
      aria-modal="true"
      aria-label={labels.dialog}
    >
      <div className={css.mask} aria-hidden="true" onMouseDown={requestClose} />
      <img ref={imageRef} className={css.image} src={src} alt={alt} />
      <button ref={closeRef} type="button" className={css.close} aria-label={labels.close} onClick={requestClose}>
        <IconCloseOutline16 size={16} />
      </button>
    </div>,
    document.body,
  )
}
