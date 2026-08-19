# mnh-desktop-app

[English](README.md) | 中文

桌面组合层保留 Web 客户端插件名录，只把 loopback HTTP 载体替换为 `mnh-host-desktop-bridge`。Electron 从同一组已构建产物提供 `mnh://app/*` 与 `mnh://plugins/*`，API 和事件流通过一个转移的 MessagePort 传输。桌面安装通过 base 与 Web 层包含 `mnh-llm-pi-ai`、Models 设置页和按模型选择控件，因此 OpenAI/Codex 与 Anthropic/Claude API 模型无需桌面专用适配器。

该层禁用浏览器 Web 服务器、URL 启动器和 WebSocket client-HMR 行。Web 自动目录选择器依赖 bind host 信息，因此这里直接选择既有的 browse provider。会话存储、RPC 信封和客户端 UI 包保持不变。缺少 bridge 或同时组合两个物理载体时，connection 插件会在激活时失败。

## 模型体验

### 桌面表层组合

#### 模型看到的内容

桌面层自身不注册面向模型的内容。禁用 Web runtime 也会省略该组合包提供的 `harness:source` 与 `app:web-surface` 提示词段落，以及受管环境变量 `MNH_WEB_URL`；base 组合包和其余各插件仍分别持有自己的模型可见内容。

#### Token 影响

该层不增加 token。与 Web 表层相比，被省略的 Web 专属段落和环境变量不会占用 token。

#### KV Cache 影响

载体选择本身没有影响。桌面组合在进程生命周期内固定，因此不会引入逐轮次变化的请求前缀。

## 已知限制与延期工作

- **修改 profile patch 后必须重启应用**——Electron 禁用 Loader 的 profile-patch watcher，因为桌面进程不能使用浏览器 HMR loader 路径；启动时仍会正常应用初始 patch。
- **桌面载体一次只服务一个 renderer port**——该组合面向单个 Electron 窗口；增加窗口前需要明确 port 的所有权和会话策略。
