# `@aflydream/mnh-host-desktop-bridge`

[English](README.md) | 中文

Electron MessagePort 载体，负责承载宿主 API。`DesktopBridgeService`（`ctx.desktopBridge`）接收带路径前缀的路由，路由处理器返回 Fetch `Response`，服务随后通过转移的 port 分发 renderer 请求，不打开 TCP 监听器。多个路由匹配时选择最长前缀；没有匹配的请求返回 HTTP 404。注册路由会返回 disposer，并拒绝重复路径或格式错误的前缀。每个请求都有独立的 abort controller；renderer 发送 abort 消息时取消对应处理器，port 释放时取消该 port 上的所有请求。

bridge 只负责传输。API 路由仍由 [`mnh-apiproxy`](../apiproxy/README.md) 提供，Electron 壳负责 `MessageChannelMain` 转移，renderer 负责客户端实现。响应头和 body 分块按顺序转发，处理器失败时只为对应请求发送 response error。服务信任同进程内的类型化路由注册，并在创建宿主 `Request` 前校验从 renderer 收到的消息。

## 模型体验

### 宿主传输

#### 模型看到的内容

该包不向模型提供任何内容。`DesktopBridgeService` 只传输宿主请求和响应，不组装或发送模型请求。

#### Token 影响

无；该载体不增加提示词、消息、工具 schema 或工具结果内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **附加的 port 共享取消状态**——服务可以附加多个 port，但路由和请求取消状态由宿主统一管理；关闭一个 port 会取消所有进行中的请求。因此多窗口使用前需要明确所有权和会话策略。
- **没有传输协议版本协商**——Electron main 与 renderer 一起发布；在独立发布客户端之前，不兼容的消息改动会在请求路径失败。
