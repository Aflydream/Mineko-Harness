/** MiNeko brand emblem icon and lockup. */
import type { IconProps } from './props.ts'

/**
 * MiNeko geometric brand emblem.
 * @param props - square size and optional className.
 * @returns SVG element.
 */
export function MiNekoEmblem({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mnh-emblem-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F80FF" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="mnh-inner-grad" x1="10" y1="10" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      {/* Outer rounded badge base */}
      <rect x="3" y="3" width="26" height="26" rx="8" fill="url(#mnh-emblem-grad)" fillOpacity="0.12" stroke="url(#mnh-emblem-grad)" strokeWidth="1.5" />
      {/* Cat ears & face outline */}
      <path
        d="M8 10L11 16H21L24 10L22 22C22 23.6569 20.6569 25 19 25H13C11.3431 25 10 23.6569 10 22L8 10Z"
        fill="url(#mnh-emblem-grad)"
        fillOpacity="0.85"
      />
      {/* Left ear inner accent */}
      <path d="M9.5 12L11 15H13L10.8 11.5L9.5 12Z" fill="#FFFFFF" fillOpacity="0.75" />
      {/* Right ear inner accent */}
      <path d="M22.5 12L21 15H19L21.2 11.5L22.5 12Z" fill="#FFFFFF" fillOpacity="0.75" />
      {/* Center Nexus Eye / Core Diamond */}
      <circle cx="16" cy="19" r="2.2" fill="#FFFFFF" />
      {/* Whiskers / subtle side circuit lines */}
      <path d="M6 18H8.5M6 20.5H9M26 18H23.5M26 20.5H23" stroke="url(#mnh-inner-grad)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
