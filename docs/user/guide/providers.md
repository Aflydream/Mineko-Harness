# Configure models

English | [中文](providers.zh.md)

This guide works with both `pnpm run desktop` and `pnpm mnh web`. Open **Settings → Models** in either client to configure providers. The application does not show a startup credential dialog when a provider is missing; model setup is an explicit Settings action. Changes take effect on the next request without restarting the desktop or Web profile.

## Before you configure

Build the workspace once, then choose the carrier you want:

```sh
pnpm run build
pnpm run desktop
```

For the browser profile, use:

```sh
pnpm run build
pnpm mnh web
```

The desktop uses Electron plus a Node.js Host and does not start a Web server. The Web profile prints a local URL and uses browser transport. Both surfaces use the same provider directory, credential service, model picker, and durable session behavior.

## Configure DeepSeek

Open **Settings → Models** and use the DeepSeek setup card or its **Edit** action. Enter the API key and save it. You may also provide `DEEPSEEK_API_KEY` and the optional `DEEPSEEK_BASE_URL` in the launch environment; an environment credential is read-only from the UI.

![The Models page: the DeepSeek card, with Add provider and Add a custom provider below it](providers-models-page.png)

Keys are write-only. The page receives a redacted descriptor after saving, never the literal secret. The key is stored in `$MNH_HOME/.credentials.yaml`, while settings retain only its credential reference.

## Add a catalog provider

Choose **Add provider**, select a provider such as Anthropic or OpenAI, enter its API key when that adapter uses API-key authentication, and save. The installed catalog supplies the endpoint, protocol, and model list. The catalog can also expose providers that use native authentication; those providers must be configured through the authentication path they declare.

The generic card cannot complete authentication that needs more than a provider id, endpoint, and API key. Bedrock needs AWS credentials and a region, Vertex needs an ADC project, Azure needs its `api-version` and provider-specific credentials, and Codex uses OAuth. OpenAI/Codex and Anthropic/Claude API models are available through the pi-ai adapter when the corresponding provider is configured; Codex CLI and Claude Code subagent runtimes are separate optional delegation providers.

## Add a custom provider

Choose **Add a custom provider** for a company gateway, self-hosted server, or provider absent from the installed catalog. Supply a lowercase Provider ID, base URL, API protocol, credential when required, and at least one model.

![The custom provider form: Provider ID, display name, base URL, API protocol, and API key](providers-custom-form.png)

The Provider ID is permanent because requests, saved sessions, model defaults, and credential references use it. To rename a provider, add a new provider and delete the old one. The display name, base URL, protocol, credential, and models remain editable.

Under **Model catalog**, choose **Fetch available models** to query the base URL and credential currently shown in the form. Selecting candidates updates the draft; the provider is not stored until you save. Catalog providers use their installed catalog without a network request.

### Image input

A model you enter by hand is treated as text-only until it says otherwise, because nothing can ask an endpoint which modalities it accepts. Attaching an image to such a model is refused before it is sent, naming the model.

A vision model on a custom provider therefore needs one line. The form has no field for it; add `input` to the model in `$MNH_HOME/settings.yaml`:

```yaml
llm-pi-ai:
  providers:
    my-gateway:
      apiKeyEnv: GATEWAY_API_KEY
      api: openai-completions
      baseURL: https://gateway.example/v1
      models:
        - id: legacy-chat
        - id: vision-preview
          input: [text, image]
```

`input` accepts `text` and `image`, and applies to that model alone, so one route can serve both kinds. Omitting it — or writing an empty list, which means the same thing — keeps whatever the installed catalog records for that model, and falls back to the route's `defaultInput` for a model the catalog does not describe.

If every model you entered by hand takes images, set the fallback once on the route instead of on each of them:

```yaml
llm-pi-ai:
  providers:
    vision-gateway:
      apiKeyEnv: GATEWAY_API_KEY
      api: openai-completions
      baseURL: https://vision.example/v1
      defaultInput: [text, image]
      models:
        - id: first-model
        - id: second-model
```

`defaultInput` is a fallback, not an override, and defaults to `[text]`: on a catalog provider it answers only for models the catalog does not describe, so it never removes images from a catalog model that has them. Narrow one of those with that model's own `input`. A catalog provider has no `models` list to put it in, so write it under `modelOverrides`, keyed by model id:

```yaml
llm-pi-ai:
  providers:
    anthropic:
      modelOverrides:
        claude-sonnet-4-5:
          input: [text]
```

Every list must name at least one modality except a model's own, where an empty list means the same as omitting it. An unknown modality is refused wherever it is written.

Both fields state a claim about your endpoint rather than checking it. A model that declares images its endpoint does not serve is not caught here; the provider rejects the request instead.

## Select a model and reasoning level

Configured providers appear in the model picker. Selecting a model also makes it the default for new sessions. The reasoning control shows only levels declared by that specific model, so one provider can expose different choices for different models. A session that has already sent a request retains the provider, model, and reasoning level recorded in its own log.

If a saved default names a provider that was deleted, the composer displays **Select model** and blocks input until another model is selected.

## Troubleshooting

- **`MISSING_CREDENTIAL`** — Store the provider key through the Models page, supply the referenced environment variable, or complete the provider's native authentication path.
- **`UNKNOWN_MODEL`** — Select a configured model or add the missing model to the custom provider.
- **Fetching available models returns 401** — Check the key. Model discovery calls the OpenAI-compatible `GET /models` endpoint; enter models manually for endpoints that do not provide it.
- **An image is refused before sending** — The model declares no image modality. Give a custom provider's model `input: [text, image]`; DeepSeek's own chat-completions route is text-only and cannot be configured otherwise.
- **The provider rejects a request carrying an image** — The model declares images its endpoint does not actually serve. Remove `image` from whichever list granted it — the model's `input`, or the route's `defaultInput` — then start a new session: the attached image stays in the session log, so the same request repeats until the session moves off it.

## Advanced configuration

The generated [plugin configuration catalog](../../../AgentGuide/reference/config-catalog.md) lists every supported field and default. The [`mnh-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) and [`mnh-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) references own direct `settings.yaml` configuration, catalog resolution, reasoning controls, credentials, and adapter errors.
