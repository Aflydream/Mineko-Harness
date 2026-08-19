# 贡献

[English](CONTRIBUTING.md) | 中文

MiNeko Herness 欢迎外部 Issue 和 PR。本项目是仅面向 Windows 的桌面项目，目前没有 macOS 或 Linux 桌面版本计划。

## 项目范围

贡献内容应改进 Windows 桌面应用、Electron 与 Node.js 运行时、共享 harness 包、文档或 Windows 发布流程。除非项目范围先获得明确变更，否则不要新增 macOS 或 Linux 桌面目标。

## 提交 Issue

Bug、功能请求、研究和任务请使用 [Issue 模板](https://github.com/Aflydream/Mineko-Harness/issues/new/choose)。

- 先搜索现有 Issue，避免重复提交。
- 报告 Bug 时说明实际结果、预期结果、运行环境和可复现路径。
- 不要在 Issue 中提交凭据、token、私有日志或个人数据。

## 提交 PR

- Fork 仓库，并从 `master` 创建范围明确的分支。
- 需要提前获得反馈时可以先提交 Draft PR，完成后再标记为 ready。
- PR 正文至少关联一个同仓库 Issue。PR 应解决 Issue 时使用 `Fixes #NN`，仅提供上下文时使用 `Related to #NN`。
- 说明用户可见变化，并附上范围最小的相关验证。桌面端变更应在条件允许时运行 `pnpm run build` 和针对性的桌面检查。
- 不要提交凭据、运行时会话、生成的本地状态或无关格式化改动。

## 评审期望

维护者会检查正确性、Windows 兼容性、性能、安全边界、持久会话行为和文档影响。CI 是证据，不代替人工评审。合并前，维护者可能要求缩小范围、补充测试或更新文档。

## 社区贡献

欢迎插件、教程、Bug 报告、设计想法和性能数据。如果提案涉及更广泛的平台或架构决策，请先在 Issue 中描述问题与取舍，再开始实现。

MiNeko Herness 按 [MIT 许可证](LICENSE)发布。第三方包、内置源码及其许可证记录在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 中。
