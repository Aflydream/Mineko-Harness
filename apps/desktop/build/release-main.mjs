/** Electron entry point used only by the staged Windows release. */

process.env.MNH_DESKTOP_PROFILE_BOOT_URL = new URL('./lib/profile-boot.js', import.meta.url).href

await import('@aflydream/mnh-desktop')
