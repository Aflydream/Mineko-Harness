<p align="center">
  <img src="logo.png" alt="MiNeko Herness 标志" width="112">
</p>

<h1 align="center">MiNeko Herness</h1>

<p align="center"><strong>Make Everything Happen</strong></p>

<p align="center">面向 Windows 的 Electron + Node.js 桌面插件化 Agent Harness。</p>

[English](README.md)

MiNeko Herness（`mnh`）是基于仓库内置 Cordis 插件运行时构建的独立 Agent Harness。Windows 桌面应用使用 Electron 承载界面，由 Node.js 运行 agent、插件、工具、会话和模型适配器。应用通过私有 `mnh://` 协议加载构建后的客户端，不会启动 Web 服务或 TCP 监听端口。

> **Windows-only 项目。** MiNeko Herness 面向 Windows 桌面端。目前没有 macOS 或 Linux 桌面版本计划。仓库中保留的非 Windows CI 只验证可复用的仓库组件，不代表桌面端支持这些平台。

本项目基于 MIT 许可证从 DeepSeek Harness 衍生而来。MiNeko Herness 与 DeepSeek 不存在隶属或官方背书关系。

## 仓库数据

以下数据读取自当前 workspace 清单。

| 项目 | 数值 | 统计来源 |
|---|---:|---|
| Node.js 要求 | `^22.19.0` 或 `>=24.0.0` | `package.json#engines` |
| pnpm 版本 | `11.7.0` | `package.json#packageManager` |
| Electron 版本 | `43.4.0` | `apps/desktop/package.json` |
| Workspace 项目 | 240 | `pnpm-workspace.yaml` 匹配到的 package 清单 |
| Harness 包 | 49 个功能组中的 221 个包 | `packages/*/*/package.json` |
| 应用项目 | 3 | `apps/*/package.json` |

<a id="quick-start"></a><a id="快速开始"></a>

## 启动 Windows 桌面端

安装 Git、受支持的 Node.js 版本和 pnpm 11，然后运行：

```sh
git clone https://github.com/Aflydream/Mineko-Harness.git
cd Mineko-Harness
pnpm install
pnpm run build
pnpm run desktop
```

`pnpm run desktop` 是桌面开发入口。它会启动 Electron 主进程和完整桌面 profile，不需要打开浏览器地址。

## 核心能力

- **插件化组合：** 工具、模型适配器、存储、权限、工作流、界面模块和 agent loop 都是 Cordis 插件，通过 profile 与 `cordis.yml` 配置层完成组合。
- **模型与推理等级：** 每个会话从适配器提供的目录中选择服务商和模型。模型可以声明自身支持的推理等级，界面会将这些等级作为会话选项提供。
- **Agent 工作区：** 对话、工具调用、文件、终端、计划、目标、任务、工作流、审批和 agent 委派集中在同一个桌面工作区。
- **持久会话：** 仅追加日志支持恢复、重放、分叉、遥测，并能重建所有模型可见输入。
- **可替换执行能力：** 本地与沙箱化的文件系统、Shell、子进程、终端、LSP、Web、skill 和 subagent 服务可以自由组合，无需硬编码到 agent loop。
- **Agent 委派：** 安装并配置相应运行环境后，subagent 服务可使用同进程、fork、ACP、Codex、Claude Code 和基于 SDK 的 Harness 实例。

## 配置模型

在桌面应用中打开**设置 → 模型**，添加服务商凭据并选择模型。推理等级选择器只会显示该模型声明支持的等级。DeepSeek 凭据也可以通过环境变量 `DEEPSEEK_API_KEY` 和可选的 `DEEPSEEK_BASE_URL` 提供；请勿提交凭据。

[模型配置教程](docs/user/guide/providers.md)介绍了内置服务商与自定义 OpenAI 兼容端点。

## 仓库分布

| 路径 | 功能 |
|---|---|
| `apps/desktop/` | Electron 主进程、preload 桥接、Windows 身份、打包和桌面测试 |
| `apps/cli/` | Profile 启动、命令解析、插件管理和桌面启动调度 |
| `apps/web/` | 共享渲染端构建；Electron 通过 `mnh://` 提供其产物，不会启动 Web 服务 |
| `packages/` | 按能力分组的 221 个 Harness 包，包括核心、LLM、工具、会话、客户端、API、工作流和 subagent |
| `examples/` | 可运行的 profile 组合与快照场景 |
| `native/` | 面向仓库基础设施的隔离原生辅助程序，不构成桌面平台目标 |
| `python/` | Python SDK 与捆绑运行时 |
| `docs/` | 用户、插件和 Cordis 教程 |
| `AgentGuide/` | 面向 coding agent 的上手、架构、所有权和工程规则 |
| `vendor/` | 按仓库 vendoring 流程维护的固定 Cordis 源码 |
| `website/` | 文档站点投影 |
| `scripts/` | 构建、发布工具、生成器和仓库检查脚本 |

<a id="development"></a>

## 学习与贡献

- [使用应用](docs/user/guide/index.md)
- [制作第一个 Harness 插件](docs/user/develop/basic/index.md)
- [学习 Cordis 插件运行时](docs/cordis-tutorial/index.md)
- [阅读 AgentGuide](AgentGuide/README.md)
- [阅读贡献指南](CONTRIBUTING.md)

## 参与贡献

欢迎提交 Issue 和 PR。Bug、功能、研究和任务都可以使用仓库现有的 Issue 模板。PR 应保持在 Windows 桌面端范围内，关联同一仓库的 Issue，说明用户可见变化，并附上针对性的验证结果。提交前请阅读[贡献指南](CONTRIBUTING.md)。

MiNeko Herness 按 [MIT 许可证](LICENSE)发布。第三方包、内置源码及其许可证记录在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)中。

## 社区
- [linux.do](linux,do)
- QQ 群组
> 暂未设立，即将推出
