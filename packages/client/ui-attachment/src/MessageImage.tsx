import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ImageAttachmentRef } from '@aflydream/mnh-attachment'
import { ImageLightbox } from './ImageLightbox.tsx'
import type { ImageLightboxLabels } from './ImageLightbox.tsx'
import css from './MessageImage.module.css'

/** Loads a session-authorized durable image URL. */
export type ImageLoader = (attachment: ImageAttachmentRef) => Promise<string>

/** Message-image strings the owner resolves from its own locale namespace. */
export interface MessageImageLabels {
  /** Fallback display name for an unnamed image. */
  image: string
  /** Thumbnail tooltip inviting the original-image preview. */
  open: string
  /** Accessible thumbnail label; receives the image's display name. */
  openNamed: (label: string) => string
  /** Loading placeholder shown until bytes resolve. */
  loading: string
  /** Retry-control label shown when the load fails. */
  loadFailed: string
  /** Lightbox strings forwarded to the opened preview. */
  lightbox: ImageLightboxLabels
}

/** Display box for a lone image (DeepSeek Chat rule): long edge 240px with
 * the rendered aspect ratio clamped to [0.25, 4] — the overflow is cropped by
 * `object-fit: cover` — and never upscaled past the image's natural size. The
 * crop anchor keeps the top of very tall images and the left of very wide
 * ones, where the informative content usually starts. */
function singleFit(attachment: ImageAttachmentRef): { width: number; height: number; objectPosition: string } {
  const natural = attachment.width / attachment.height
  const ratio = Math.min(4, Math.max(0.25, natural))
  const box = ratio >= 1 ? { width: 240, height: 240 / ratio } : { width: 240 * ratio, height: 240 }
  const scale = Math.min(1, attachment.width / box.width, attachment.height / box.height)
  return {
    width: Math.max(1, Math.round(box.width * scale)),
    height: Math.max(1, Math.round(box.height * scale)),
    objectPosition: natural < 0.25 ? 'center top' : natural > 4 ? 'left center' : 'center',
  }
}

/**
 * Compact history renderer with viewport-aware retryable loading and
 * click-to-open original preview. A lone image renders at its `singleFit`
 * size; an image among several renders as a fixed 64px square tile. The
 * durable image is loaded when its thumbnail intersects the viewport, is
 * focused, or is clicked; browsers without `IntersectionObserver` load it
 * eagerly.
 *
 * @param props.attachment - the durable image reference to load and bound.
 * @param props.load - session-authorized URL loader.
 * @param props.variant - `single` for a message's lone image, `tile` otherwise.
 * @param props.labels - resolved strings (tooltip, loading, retry, lightbox).
 * @returns the bounded thumbnail button, or the retry control on failure.
 */
export function MessageImage({ attachment, load, variant, labels }: {
  attachment: ImageAttachmentRef
  load: ImageLoader
  variant: 'single' | 'tile'
  labels: MessageImageLabels
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const frameRef = useRef<HTMLButtonElement>(null)
  const imageKey = String(attachment.attachmentId)
  const [loadKey, setLoadKey] = useState<string | null>(() => (
    typeof IntersectionObserver === 'undefined' ? imageKey : null
  ))
  // Retry re-arms the one load effect below, so every attempt — first load or
  // retry — runs under the same liveness guard and the same reset.
  const [attempt, setAttempt] = useState(0)
  const startLoading = useCallback(() => { setLoadKey(imageKey) }, [imageKey])
  const request = useCallback(() => {
    setLoadKey(imageKey)
    setAttempt(a => a + 1)
  }, [imageKey])
  const close = useCallback(() => { setOpen(false) }, [])
  const fit = useMemo(
    () => (variant === 'single' ? singleFit(attachment) : undefined),
    [attachment, variant],
  )

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setLoadKey(imageKey)
      return
    }
    const target = frameRef.current
    if (target === null) {
      setLoadKey(imageKey)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting || entry.intersectionRatio > 0)) {
        setLoadKey(imageKey)
        observer.disconnect()
      }
    })
    observer.observe(target)
    return () => { observer.disconnect() }
  }, [imageKey])

  useEffect(() => {
    if (loadKey !== imageKey) return
    let live = true
    setError(false)
    setSrc(null)
    void load(attachment).then((url) => { if (live) setSrc(url) }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [attachment, imageKey, load, attempt, loadKey])

  const label = attachment.name ?? labels.image
  if (error) return <button type="button" className={css.error} data-variant={variant} onClick={request}>{labels.loadFailed}</button>
  return (
    <>
      <button
        type="button"
        ref={frameRef}
        className={css.frame}
        data-variant={variant}
        style={fit === undefined ? undefined : { width: fit.width, height: fit.height }}
        title={labels.open}
        aria-label={labels.openNamed(label)}
        onFocus={startLoading}
        onClick={() => { if (src !== null) setOpen(true); else startLoading() }}
      >
        {src === null
          ? <span className={css.loading}>{labels.loading}</span>
          : <img src={src} alt={label} loading="lazy" decoding="async" style={fit === undefined ? undefined : { objectPosition: fit.objectPosition }} />}
      </button>
      {open && src !== null && <ImageLightbox src={src} alt={label} labels={labels.lightbox} onClose={close} />}
    </>
  )
}

/** Wrapping image group shared by user and assistant history: a lone image
 * renders large, several render as 64px square tiles (DeepSeek Chat rule). */
export function ImageGallery({ images, load, align, labels }: {
  images: readonly { attachment: ImageAttachmentRef }[]
  load: ImageLoader
  align: 'start' | 'end'
  labels: MessageImageLabels
}) {
  if (images.length === 0) return null
  const variant = images.length === 1 ? 'single' : 'tile'
  return (
    <div className={css.gallery} data-align={align}>
      {images.map((image, index) => (
        <MessageImage key={`${image.attachment.attachmentId}:${index}`} {...image} load={load} variant={variant} labels={labels} />
      ))}
    </div>
  )
}
