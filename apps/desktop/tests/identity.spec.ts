import { describe, expect, it, vi } from 'vitest'
import {
  applyDesktopTaskbarIdentity,
  DESKTOP_APP_NAME,
  DESKTOP_APP_USER_MODEL_ID,
} from '../src/identity.ts'

describe('Windows desktop identity', () => {
  it('applies the product app id and icon to the Windows taskbar button', () => {
    const window = { setAppDetails: vi.fn() }

    applyDesktopTaskbarIdentity(window, 'C:/MiNeko-Herness/mineko.ico', 'win32')

    expect(window.setAppDetails).toHaveBeenCalledWith({
      appId: DESKTOP_APP_USER_MODEL_ID,
      appIconPath: 'C:/MiNeko-Herness/mineko.ico',
    })
  })

  it('does not call the Windows-only API on other platforms', () => {
    const window = { setAppDetails: vi.fn() }

    applyDesktopTaskbarIdentity(window, '/tmp/logo.png', 'linux')

    expect(window.setAppDetails).not.toHaveBeenCalled()
  })

  it('keeps the runtime display name stable', () => {
    expect(DESKTOP_APP_NAME).toBe('MiNeko Herness')
    expect(DESKTOP_APP_USER_MODEL_ID).toBe('com.aflydream.minekoherness')
  })
})
