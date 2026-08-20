# Architecture

MiNeko Harness is a Cordis application in which product behavior is assembled from plugins. Applications choose a profile and overlays; bundles select plugins; plugins contribute services, events, tools, client modules, or providers.

## Composition

```text
application command
  -> profile and patch overlays
  -> Cordis loader
  -> product bundles
  -> capability definitions, providers, and consumers
  -> agent and client runtime
```

`cordis.yml` files are executable composition, not passive metadata. Their plugin order, inject declarations, overlays, and disabled expressions affect runtime behavior.

## Capability roles

A replaceable capability has three roles:

1. A service definition owns the public types, events, registration API, and shared failure semantics.
2. A provider implements one environment or backend and registers through Cordis effects.
3. A consumer exposes the capability to an agent, command, interface, transport, or another service.

Do not add a provider without a usable consumer and service definition. Provider-specific defaults remain in the provider; consumer presentation remains in the consumer.

## Agent and session flow

```text
user input
  -> durable session event
  -> agent admission and request context
  -> model adapter selection
  -> streamed model response
  -> tool calls and durable results
  -> projections consumed by desktop, Web, SDK, and replay
```

The session log is the authority for replay and reconstruction. A new prompt fragment, hidden context field, tool-visible value, or other model input requires durable provenance.

## Models and reasoning

The LLM service routes requests to registered adapters. Adapters own provider discovery, model catalogs, context limits, maximum-token defaults, retry policy, and supported reasoning levels. Interface controls project these declarations; they do not invent provider capabilities.

Codex and Claude Code integrations live in the subagent provider layer. They launch and control their corresponding installed runtimes; they are distinct from selecting an ordinary LLM adapter for the main agent.

## Tools and execution

Tools consume execution capabilities such as filesystem, shell, subprocess, terminal, LSP, Web, skills, jobs, and workflows. Validation occurs at parser, configuration, durable storage, process, worker, model/tool JSON, and wire inputs. Typed same-process calls rely on TypeScript rather than repeating hostile-input validation.

Tool render intent is declared with the tool and projected by each interface. Execution code must not import interface components.

## Host and client

The Host owns plugins, agents, sessions, credentials, execution, and RPC implementations. The client owns presentation and session interaction. Typert-generated contracts and the SDK carry explicit remote calls between them.

The Electron desktop transfers one MessagePort through preload and serves renderer assets with `mnh://`. The browser renderer receives the same client module graph used by the Web carrier, while desktop startup does not create a Web server.

## Extension rules

- Add behavior at an existing plugin event or service whenever the ownership is already represented.
- Change the central agent loop only when no documented extension point can own the behavior.
- Register contributions through `ctx.effect()` or `ctx.on()` and return exact disposers.
- Publish derived state and notifications only after the owning operation commits.
- Keep deployment choices validated and configurable in `cordis.yml` plugin configuration.
