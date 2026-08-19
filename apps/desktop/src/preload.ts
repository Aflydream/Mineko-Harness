/**
 * Electron preload: transfers exactly one MessagePort facade to the page.
 * Electron and Node APIs remain in the isolated preload and main worlds.
 */

import { contextBridge, ipcRenderer } from 'electron'

interface PortReady {
  port: MessagePort
}

let deliver!: (ready: PortReady) => void
const ready = new Promise<PortReady>((resolve) => { deliver = resolve })

ipcRenderer.on('mnh-port', (event) => {
  const port = event.ports[0]
  if (port !== undefined) deliver({ port })
})

contextBridge.exposeInMainWorld('mnhDesktop', {
  connect: async () => {
    const { port } = await ready
    port.start()
    return {
      send: (message: unknown): void => { port.postMessage(message) },
      onMessage: (listener: (message: unknown) => void): (() => void) => {
        const handler = (event: MessageEvent): void => { listener(event.data) }
        port.addEventListener('message', handler)
        return () => { port.removeEventListener('message', handler) }
      },
    }
  },
})
