import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@aflydream/mnh-loader-smoke'
const binScript = fileURLToPath(new URL('./fixtures/mnh-badge/snapshot.ts', import.meta.url))
const configPath = fileURLToPath(new URL('./fixtures/mnh-badge/cordis.yml', import.meta.url))
const defaultConfigPath = fileURLToPath(new URL('./fixtures/mnh-badge/default.cordis.yml', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url))
const badgeAssetsPath = fileURLToPath(new URL('../../../packages/skill/skill-badge/assets/', import.meta.url))

describe('mnh badge assembled snapshot', () => {
  it('advertises and loads the opt-in bundled skill through the shipped app', async () => {
    const disabled = await runLoaderSmoke({
      label: 'disabled mnh badge skill snapshot',
      tempDirPrefix: 'headless-snapshot-mnh-badge-disabled-',
      binScript,
      libBinScript: binScript,
      configPath: defaultConfigPath,
      tsconfigPath,
    })
    const enabled = await runLoaderSmoke({
      label: 'mnh badge skill snapshot',
      tempDirPrefix: 'headless-snapshot-mnh-badge-',
      binScript,
      libBinScript: binScript,
      configPath,
      tsconfigPath,
    })
    const disabledSnapshot = JSON.parse(disabled.stdout) as unknown
    const enabledSnapshot = JSON.parse(
      enabled.stdout.replaceAll(badgeAssetsPath, '{{badgeAssetsPath}}'),
    ) as unknown

    expect(disabled.stderr).toBe('')
    expect(enabled.stderr).toBe('')
    expect(disabledSnapshot).toMatchInlineSnapshot(`
      {
        "catalog": null,
        "result": {
          "content": [
            {
              "text": "Error: skill "mnh-badge" is unknown or no longer available",
              "type": "text",
            },
          ],
          "error": {
            "message": "skill "mnh-badge" is unknown or no longer available",
          },
          "isError": true,
        },
        "summary": null,
      }
    `)
    expect(enabledSnapshot).toMatchInlineSnapshot(`
      {
        "catalog": [
          {
            "text": "<system-reminder>
      A skill is a reusable set of task-specific instructions. The following skills are available in this session:

      <available_skills>
      - \`mnh-badge\`: Add the official “powered by mnh” badge to documents, pull requests, merge requests, and other content produced with MiNeko Harness. Use whenever creating a pull request or merge request. Also use when the user asks for a mnh badge, powered-by-mnh attribution, or a reusable mnh badge asset or snippet.
      </available_skills>

      If the user names a skill, or the task clearly matches a skill's description, call the \`skill\` tool with the exact skill name before taking task actions. Load all applicable skills, then follow their full instructions. This catalog contains summaries only; do not infer or follow a skill's instructions until it has been loaded.
      A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the \`skill\` tool again for that skill.
      </system-reminder>",
            "type": "text",
          },
        ],
        "result": {
          "content": [
            {
              "text": "<skill_content name="mnh-badge">
      <skill_resources>
      Base directory for this skill: {{badgeAssetsPath}}
      Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.
      </skill_resources>

      <skill_instructions>
      # mnh Badge

      Add the official “powered by mnh” badge without recreating or restyling it.

      ## Assets

      - Local PNG: [\`mnh-badge.png\`](mnh-badge.png), 726×120 source image; render at 121×20
      - Shields.io image URL: \`https://img.shields.io/badge/powered_by-mnh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white\`
      - Project URL: \`https://github.com/aflydream/mineko-harness\`

      ## Markdown

      Use this linked badge in Markdown:

      \`\`\`markdown
      [![](https://img.shields.io/badge/powered_by-mnh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/aflydream/mineko-harness)
      \`\`\`

      If attribution should not be linked, use:

      \`\`\`markdown
      ![](https://img.shields.io/badge/powered_by-mnh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)
      \`\`\`

      ## Usage rules

      - For GitHub or GitLab Markdown, use the Shields.io URL and link it to the project URL unless the user asks for an unlinked image.
      - For Feishu and other systems that import remote images unreliably, upload \`mnh-badge.png\` from this skill directory instead of generating another badge.
      - Preserve the badge's 121×20 dimensions and aspect ratio.
      - Place the badge at the end of the attributed document or section unless the user specifies another position.
      - Do not substitute another color, logo, label, or project URL.

      </skill_instructions>
      </skill_content>",
              "type": "text",
            },
          ],
          "isError": false,
          "value": {
            "content": "# mnh Badge

      Add the official “powered by mnh” badge without recreating or restyling it.

      ## Assets

      - Local PNG: [\`mnh-badge.png\`](mnh-badge.png), 726×120 source image; render at 121×20
      - Shields.io image URL: \`https://img.shields.io/badge/powered_by-mnh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white\`
      - Project URL: \`https://github.com/aflydream/mineko-harness\`

      ## Markdown

      Use this linked badge in Markdown:

      \`\`\`markdown
      [![](https://img.shields.io/badge/powered_by-mnh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/aflydream/mineko-harness)
      \`\`\`

      If attribution should not be linked, use:

      \`\`\`markdown
      ![](https://img.shields.io/badge/powered_by-mnh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)
      \`\`\`

      ## Usage rules

      - For GitHub or GitLab Markdown, use the Shields.io URL and link it to the project URL unless the user asks for an unlinked image.
      - For Feishu and other systems that import remote images unreliably, upload \`mnh-badge.png\` from this skill directory instead of generating another badge.
      - Preserve the badge's 121×20 dimensions and aspect ratio.
      - Place the badge at the end of the attributed document or section unless the user specifies another position.
      - Do not substitute another color, logo, label, or project URL.
      ",
            "name": "mnh-badge",
            "provider": "mnh-badge",
            "resourceBase": {
              "kind": "directory",
              "path": "{{badgeAssetsPath}}",
            },
          },
        },
        "summary": {
          "description": "Add the official “powered by mnh” badge to documents, pull requests, merge requests, and other content produced with MiNeko Harness. Use whenever creating a pull request or merge request. Also use when the user asks for a mnh badge, powered-by-mnh attribution, or a reusable mnh badge asset or snippet.",
          "invocation": {
            "modelInvocable": true,
            "userInvocable": true,
          },
          "name": "mnh-badge",
          "provider": "mnh-badge",
          "resourceBase": {
            "kind": "directory",
            "path": "{{badgeAssetsPath}}",
          },
          "source": "bundled",
        },
      }
    `)
  }, LOADER_SMOKE_TEST_TIMEOUT_MS * 2)
})
