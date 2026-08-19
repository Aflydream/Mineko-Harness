# Electron Desktop Bridge

English | [中文](desktop-bridge.zh.md)

The [`mnh-host-desktop-bridge`](../../../packages/host/desktop-bridge) package is the socket-free physical carrier for the Electron desktop composition. The Electron main process owns `ctx.desktopBridge`; the renderer sends fetch-shaped messages through a transferred `MessagePort`, and the host dispatches them to the same carrier-neutral routes used by the connection layer. Desktop startup therefore does not need a web server or a TCP listener.

## Transport boundary

The bridge transports requests, response headers, and response body chunks. It does not know about sessions, models, tools, or permissions. [`mnh-client-connection`](../../../packages/client/connection) registers the `/api` route and owns the API contract; the Electron shell owns the `MessageChannelMain` transfer and the renderer-side client.

Routes are pathname prefixes. The longest matching prefix wins, a missing route returns 404, duplicate or malformed prefixes fail at registration, and each request has an independent abort controller. Closing a port detaches its listeners, aborts requests, and closes the port. Incoming renderer messages are validated before a host `Request` is constructed; same-process route registration remains typed and trusted.

## Desktop relationship

The desktop bridge is a core transport service rather than a second application API. The web profile can continue to compose the HTTP carrier, while the desktop profile composes exactly one physical carrier through the same connection service. This keeps model-facing behavior and agent/session code identical across Electron and web deployments.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxdesktopbridge--desktopbridgeservice"></a>

### `ctx.desktopBridge` — `DesktopBridgeService`

Host service that dispatches renderer fetches without opening a socket.

```ts cordis-catalog
/**
 * Register one pathname prefix.
 * @param route - Prefix and fetch handler owned by the caller's fiber.
 * @returns a disposer that removes the route.
 */
register(route: DesktopFetchRoute): () => void

/**
 * Attach one renderer MessagePort.
 * @param port - Main-process end of the renderer's transferred channel.
 * @returns a disposer that detaches listeners, aborts requests, and closes the port.
 */
attach(port: DesktopPort): () => void
```

Source: [`packages/host/desktop-bridge/src/index.ts:78`](../../../packages/host/desktop-bridge/src/index.ts)
<!-- END GENERATED cordis-surface -->
