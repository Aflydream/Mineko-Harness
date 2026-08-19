/** Stable Windows identity shared by the runtime and taskbar metadata. */

/** User-visible product name used by the native desktop shell. */
export const DESKTOP_APP_NAME = 'MiNeko Herness'

/** Stable AppUserModelId shared by development and packaged Windows launches. */
export const DESKTOP_APP_USER_MODEL_ID = 'com.aflydream.minekoherness'

/** The taskbar properties accepted by Electron's Windows-only API. */
export interface DesktopTaskbarDetails {
  appId: string
  appIconPath: string
}

/** Minimal window surface needed to apply Windows taskbar identity. */
export interface DesktopTaskbarWindow {
  setAppDetails(options: DesktopTaskbarDetails): void
}

/**
 * Apply the stable app id and icon to a Windows taskbar button.
 * @param window - Electron window receiving the taskbar identity.
 * @param appIconPath - Absolute path to the application icon.
 * @param platform - Runtime platform; injectable for focused tests.
 * @returns Nothing.
 */
export function applyDesktopTaskbarIdentity(
  window: DesktopTaskbarWindow,
  appIconPath: string,
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform !== 'win32') return
  window.setAppDetails({ appId: DESKTOP_APP_USER_MODEL_ID, appIconPath })
}
