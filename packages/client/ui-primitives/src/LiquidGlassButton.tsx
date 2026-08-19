import { forwardRef, type ButtonHTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import css from './LiquidGlassButton.module.css'

/** Props for a glass button with optional leading and trailing content. */
export interface LiquidGlassButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Content rendered before the label. */
  icon?: ReactNode
  /** Content rendered after the label. */
  trailing?: ReactNode
  /** Button label or custom inline content. */
  children?: ReactNode
}

function setPointerLight(target: HTMLButtonElement, event: ReactPointerEvent<HTMLButtonElement>): void {
  const rect = target.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    target.style.setProperty('--mnh-liquid-x', '50%')
    target.style.setProperty('--mnh-liquid-y', '50%')
    return
  }
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
  target.style.setProperty('--mnh-liquid-x', `${x}px`)
  target.style.setProperty('--mnh-liquid-y', `${y}px`)
}

/**
 * Render a GPU-composited glass button with pointer-following refraction.
 *
 * The light position is stored on the element instead of React state, so
 * pointer movement does not rerender the button's owner. The native button
 * semantics and all ordinary button attributes remain intact.
 * @param props - button content, visual class, and native button attributes.
 * @returns a button with layered glass, refraction, and focus treatment.
 */
export const LiquidGlassButton = forwardRef<HTMLButtonElement, LiquidGlassButtonProps>(function LiquidGlassButton({
  icon,
  trailing,
  children,
  className,
  onPointerMove,
  onPointerLeave,
  type = 'button',
  ...rest
}, ref) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={clsx(css.button, className)}
      onPointerMove={(event) => {
        setPointerLight(event.currentTarget, event)
        onPointerMove?.(event)
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty('--mnh-liquid-x', '50%')
        event.currentTarget.style.setProperty('--mnh-liquid-y', '50%')
        onPointerLeave?.(event)
      }}
    >
      <span className={css.liquid} aria-hidden="true" />
      <span className={css.edge} aria-hidden="true" />
      <span className={css.content}>
        {icon != null && <span className={css.icon}>{icon}</span>}
        {children}
        {trailing != null && <span className={css.trailing}>{trailing}</span>}
      </span>
    </button>
  )
})

LiquidGlassButton.displayName = 'LiquidGlassButton'
