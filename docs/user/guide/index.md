# Use the desktop and Web interface

English | [中文](index.zh.md)

MiNeko Harness runs the same plugin-composed agent product in two user-facing profiles. The Windows desktop uses Electron for the window and Node.js for the Host, agents, tools, sessions, and model adapters. The optional Web profile serves the shared client over HTTP. The desktop profile does not start a Web server and does not require a browser URL.

## Before you start

Install the supported Node.js and pnpm versions, then build the workspace from its root:

```sh
pnpm install
pnpm run build
```

The first build prepares the Electron main process, the shared client, and the Node-side plugin graph. Keep the repository directory as the working directory when following the source-development tutorials.

## Start the Windows desktop

Run:

```sh
pnpm run desktop
```

Electron opens the MiNeko Harness window directly. There is no browser address to copy. Node.js owns the agent runtime, while the renderer communicates with it through the desktop bridge; the desktop process does not open an HTTP, WebSocket, or other TCP listener.

## Start the optional Web profile

Use the Web profile when you want a browser-based client or are following a tutorial that uses a `--patch` overlay:

```sh
pnpm mnh web
```

The terminal prints the local URL. This profile has a Web server and browser transport; it shares the same Host capabilities and session model, but it is a different carrier from the Electron desktop.

## Configure a model

The application does not require a DeepSeek key at startup. Open **Settings → Models** when you are ready to configure a provider. Add DeepSeek, an installed catalog provider, or a custom OpenAI-compatible provider, then select a model. Credentials are stored through the write-only credential path; settings retain only references and non-secret model configuration.

The model selector exposes only reasoning levels declared by the selected model adapter. Changing the provider, model, or reasoning level sets the default for a new session; an existing session keeps the model recorded in its durable log. See the [model configuration guide](./providers.md) for native authentication, custom providers, image input, and troubleshooting.

## Choose a workspace and run a task

1. Click **Choose workspace** and add the project directory the agent may access.
2. Create or select a session.
3. Send a task such as:

   > Summarize this repository and identify its main packages.

The workspace UI can show conversation messages, reasoning, tool calls, file changes, terminals, plans, goals, jobs, workflows, approvals, and delegated agents. The active permission policy decides which operations require confirmation. Sessions are durable, so you can resume or fork work instead of losing the trajectory when the window closes.

## Continue

- [Configure models](./providers.md)
- [Use the Python SDK](./python-sdk.md)
- [Use other CLI modes](../../../apps/cli/README.md)
- [Develop a plugin](../develop/basic/)
