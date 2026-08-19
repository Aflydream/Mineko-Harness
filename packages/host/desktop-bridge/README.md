# `@aflydream/mnh-host-desktop-bridge`

English | [中文](README.zh.md)

The Electron MessagePort carrier for the host API. `DesktopBridgeService` (`ctx.desktopBridge`) accepts pathname-prefix routes whose handlers return Fetch `Response` objects, then dispatches renderer requests over the transferred port without opening a TCP listener. The longest matching registered prefix wins; an unmatched request receives HTTP 404. Route registration returns a disposer and rejects duplicate paths or malformed prefixes. Each request has an independent abort controller; a renderer abort message cancels the corresponding handler, and disposing the port aborts all requests owned by it.

The bridge owns transport only. API routing remains in [`mnh-apiproxy`](../apiproxy/README.md), while the Electron shell owns the `MessageChannelMain` transfer and the renderer-side client. Response headers and body chunks are forwarded in order, and handler failures become a response error for that request. The service trusts the typed same-process route registration and validates messages received from the renderer before constructing a host `Request`.

## Model Experience

### Host transport

#### What the model sees

Nothing from this package. `DesktopBridgeService` only carries host requests and responses and does not assemble or send model requests.

#### Token effect

None; the carrier adds no prompt, message, tool schema, or tool result content.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Attached ports share cancellation state** — the service can attach more than one port, but routes and request cancellation are host-wide; closing one port aborts all in-flight requests. Multi-window use therefore requires an explicit ownership and session policy.
- **No transport protocol version negotiation** — the Electron main and renderer are shipped together, so incompatible message changes fail at the request path until a version field is needed for independently released clients.
