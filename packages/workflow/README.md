# workflow/ — dynamic-workflow capability family

English | [中文](README.zh.md)

This family runs model-authored orchestration workflows over subagents and exposes general and fixed-policy tools to the model.

| Package | Role | ctx key |
|---|---|---|
| [`workflow/`](workflow/README.md) | Defines workflow execution and lifecycle events | `ctx.workflowEngine` |
| [`workflow-worker-thread/`](workflow-worker-thread/README.md) | Runs workflow scripts in worker threads | registers on `ctx.workflowEngine` |
| [`tool-workflow/`](tool-workflow/README.md) | Exposes general workflow execution to the model | registers on `ctx.tools` |
| [`tool-ralph/`](tool-ralph/README.md) | Exposes the fixed fresh-agent Ralph workflow | registers on `ctx.tools` |

Worker threads isolate workflow execution from the host event loop but are not a security boundary. See the [dynamic-workflow](../../AgentGuide/conventions.md) and [Ralph tool](../../AgentGuide/conventions.md) decisions.

The subsystem reference — start requests, `WorkflowMeta`, results, live runs, `workflow/*` events — is [AgentGuide/reference/subsystems/workflow.md](../../AgentGuide/reference/subsystems/workflow.md); decisions in the [dynamic-workflows](../../AgentGuide/conventions.md) and [Ralph consumer](../../AgentGuide/conventions.md) Agent Notes.
