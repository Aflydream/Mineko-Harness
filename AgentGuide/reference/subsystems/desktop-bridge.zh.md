# Electron 桌面桥接

[English](desktop-bridge.md) | 中文

[`mnh-host-desktop-bridge`](../../../packages/host/desktop-bridge) 是 Electron 桌面组合使用的无 socket 物理载体。Electron main 进程拥有 `ctx.desktopBridge`；renderer 通过转移的 `MessagePort` 发送 fetch 形状的消息，宿主再把它们分发到 connection 层使用的同一组载体无关路由。因此桌面启动不需要 Web 服务或 TCP 监听器。

## 传输边界

桥接层传输请求、响应头和响应 body 分块，但不了解会话、模型、工具或权限。[`mnh-client-connection`](../../../packages/client/connection) 注册 `/api` 路由并拥有 API 合约；Electron 壳负责 `MessageChannelMain` 转移，renderer 负责客户端实现。

路由使用路径前缀，匹配时选择最长前缀；没有匹配的路由返回 404；重复或格式错误的前缀在注册时失败；每个请求都有独立的 abort controller。关闭 port 会解除监听、取消请求并关闭 port。构造宿主 `Request` 前会校验来自 renderer 的消息；同进程路由注册仍使用类型化接口并被视为可信。

## 与桌面的关系

桌面桥接是核心传输服务，而不是第二套应用 API。Web profile 仍可组合 HTTP 载体，桌面 profile 则通过同一个 connection 服务组合且只组合一个物理载体。这样 Electron 与 Web 部署可以复用完全相同的模型、agent 和会话行为。

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
