# `@aflydream/mnh-desktop`

[English](README.md) | 中文

Windows 桌面应用在 Electron 运行时中启动随附的 `desktop` profile，并复用完整的已构建 Web client，而不启动 Web 服务器。`pnpm run desktop` 与打包安装器使用同一套主进程、preload、renderer、profile 和 plugin 名单。两条路径都会转发可重复的 `--patch` overlay 与应用参数。

## 运行时

主进程会在 Electron ready 前注册 `mnh://`，让 Cordis profile 树与 Electron 初始化并行启动。Electron ready 后会创建一个隐藏 renderer，使 Chromium 进程启动与剩余 Host boot 重叠；Host 树完成后才导航到 `mnh://app/`，页面加载完成前窗口保持隐藏。`mnh://app/*` 提供 `apps/web/dist`；共享 boot graph 中的 `/plugins/<id>/client.js` URL 会在 `mnh://app/` 下解析，并路由到宿主树注册的 client bundle。显式的 `mnh://plugins/<id>/client.js` 形式访问同一个注册表。index 响应会在加载前注入启动 manifest 与启动主题脚本。

Electron 的 `userData` 根目录是 `$MNH_HOME/desktop`。Chromium 本地存储与缓存会跟随所选 Harness home，不会与无关启动共用 Electron 的通用默认 profile。

API 请求与事件流通过一个在 renderer DOM ready 时转移的 `MessagePort`，让 Host 基线请求与其余 client plugin 激活重叠。preload 只暴露 `mnhDesktop.connect()`，并返回仅含函数的 channel；`contextIsolation` 与 renderer 沙箱保持启用，Node integration 保持禁用。桌面进程不会打开 HTTP、WebSocket 或其他 TCP 监听端口。

Electron 运行时无法暴露 Node 的内部 ESM loader，因此 app boot 会通过公开的 Node fallback 解析裸 Cordis 插件包，并直接以 packaged application manifest 为基准，使 Windows 无需跟随指向 ASAR 内部的文件系统 junction。模块 HMR 与 profile patch 实时监听均被禁用：`cordis.patch.yml` 和 `--patch` 在启动时应用，后续编辑会在桌面应用重启后生效。

## 开发

在仓库根目录运行 `pnpm run build`，构建包、桌面应用与 Web 产物。`pnpm run test:desktop:built` 会在临时 `MNH_HOME` 下启动 Electron 载体，通过 `mnh://` 获取 boot graph 声明的 client bundle，并通过 preload MessagePort 完成 `host.describe`。

`pnpm run desktop` 会进入普通的源码 `mnh desktop` 命令。启动器解析仓库的 Electron 可执行文件和已构建的 `apps/desktop/lib/main.js`，移除 `ELECTRON_RUN_AS_NODE`，再启动完整桌面应用。开发窗口使用产品 AppUserModelId、无边框透明多分辨率图标、隐藏标题栏和自动隐藏的应用菜单。再次启动时会恢复并聚焦已有窗口。

`build:native` 脚本保留 `apps/desktop/native` 下隔离的 Tauri/WebView2 原型；根目录与包内的启动命令都不会选择它。

根构建通过后，`pnpm --filter @aflydream/mnh-desktop run package:win` 是唯一的 Windows 打包入口。它以 workspace 注入且禁用依赖脚本的方式，把 CLI 所有的 profile boot 及其生产依赖闭包部署到隔离的 staging 目录，拒绝任何解析到该目录外的链接，加载 staged app-boot 模块图，验证桌面 preload、Web 资源和 node-pty Windows 预构建文件，然后生成 `release/MiNeko-Harness-Setup-<version>.exe`。NSIS 安装器采用每用户的分步向导，允许选择安装目录，并创建桌面和开始菜单快捷方式。应用文件使用 ASAR，完整的 node-pty 包会被解包，使其 `.node`、ConPTY 和 WinPTY helper 可以执行。

发布环境提供 Windows 代码签名证书时，electron-builder 会读取 `CSC_LINK` 和 `CSC_KEY_PASSWORD`。未提供这些变量时会按预期生成未签名安装包，Windows 可能通过 SmartScreen 显示警告。

## 已知限制

- Windows 是受支持的桌面平台。
- 未签名的本地构建可能触发 Windows SmartScreen 警告。
- Electron 随附 Chromium，因此其基础内存占用高于隔离的 WebView2 原型。
