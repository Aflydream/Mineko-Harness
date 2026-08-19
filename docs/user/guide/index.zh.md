# 使用桌面与 Web 界面

[English](index.md) | 中文

MiNeko Herness 通过两个面向用户的 profile 提供同一套由插件组合而成的 agent 产品。Windows 桌面端用 Electron 承载窗口，用 Node.js 承载 Host、agent、工具、会话和模型适配器；可选的 Web profile 则通过 HTTP 提供共享客户端。桌面 profile 不会启动 Web 服务器，也不需要浏览器地址。

## 开始之前

安装受支持的 Node.js 与 pnpm 版本，然后在仓库根目录构建工作区：

```sh
pnpm install
pnpm run build
```

第一次构建会准备 Electron 主进程、共享客户端以及 Node 侧插件图。阅读源码开发教程时，请把仓库目录作为工作目录。

## 启动 Windows 桌面端

运行：

```sh
pnpm run desktop
```

Electron 会直接打开 MiNeko Herness 窗口，不需要复制浏览器地址。Node.js 负责 agent 运行时，渲染器通过桌面桥接与其通信；桌面进程不会打开 HTTP、WebSocket 或其他 TCP 监听器。

## 启动可选的 Web profile

如果需要浏览器客户端，或正在跟随使用 `--patch` 覆盖层的教程，请使用 Web profile：

```sh
pnpm mnh web
```

终端会打印本地地址。该 profile 有 Web 服务器和浏览器传输层；它与桌面端共享 Host 能力和会话模型，但承载方式不同于 Electron 桌面端。

## 配置模型

应用启动时不要求 DeepSeek 密钥。准备好后，打开**设置 → 模型**配置提供方。你可以添加 DeepSeek、已安装目录中的提供方，或自定义 OpenAI 兼容提供方，然后选择模型。凭据会通过只写凭据路径保存，settings 只保留引用和非机密的模型配置。

模型选择器只显示所选模型适配器声明过的推理等级。切换提供方、模型或推理等级会为新会话设置默认值；已有会话会保留其持久化日志中记录的模型。有关原生认证、自定义提供方、图片输入和排错，请参阅[模型配置指南](./providers.md)。

## 选择工作区并运行任务

1. 点击**选择工作区**，添加 agent 可以访问的项目目录。
2. 创建或选择一个会话。
3. 发送类似下面的任务：

   > Summarize this repository and identify its main packages.

工作区界面可以显示对话消息、思考过程、工具调用、文件变更、终端、计划、目标、作业、工作流、审批和委派的 agent。当前权限策略决定哪些操作需要确认。会话是持久化的，因此关闭窗口后仍可继续或分叉工作，不会丢失轨迹。

## 继续

- [配置模型](./providers.md)
- [使用 Python SDK](./python-sdk.md)
- [使用其他 CLI 模式](../../../apps/cli/README.md)
- [开发插件](../develop/basic/)
