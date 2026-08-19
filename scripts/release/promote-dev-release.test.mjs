import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as yaml from 'js-yaml'
import { test } from 'node:test'

const repositoryRoot = join(import.meta.dirname, '../..')

test('promote workflow is manual, dev-only, and calls the Windows release workflow', () => {
  const workflow = yaml.load(readFileSync(join(repositoryRoot, '.github/workflows/promote-dev-release.yml'), 'utf8'))

  assert.deepEqual(workflow.on, {
    workflow_dispatch: {
      inputs: {
        version: {
          description: 'Release version without the leading v, for example 0.1.0 or 0.1.0-rc.6',
          required: true,
          type: 'string',
        },
      },
    },
  })
  assert.deepEqual(workflow.permissions, { contents: 'write' })

  const promote = workflow.jobs.promote
  assert.equal(promote['runs-on'], 'ubuntu-24.04')
  assert.equal(promote.outputs.tag, '${{ steps.release.outputs.tag }}')
  assert.equal(promote.steps[0].if, "github.ref != 'refs/heads/dev'")

  const checkout = promote.steps.find(step => step.uses === 'actions/checkout@v6')
  assert.deepEqual(checkout.with, {
    ref: 'dev',
    'fetch-depth': 0,
    'persist-credentials': true,
  })

  const prepare = promote.steps.find(step => step.name === 'Prepare the requested version')
  assert.equal(prepare.run.includes('prepare-desktop-version.mjs --version'), true)

  const promotionPush = promote.steps.find(step => step.name === 'Promote the prepared commit to dev and main')
  assert.equal(
    promotionPush.run,
    'git push --atomic origin HEAD:refs/heads/dev HEAD:refs/heads/main',
  )

  const tag = promote.steps.find(step => step.name === 'Create the release tag')
  assert.equal(tag.run.includes('git push origin "$TAG"'), true)

  assert.deepEqual(workflow.jobs.release, {
    name: 'Build and publish Windows release',
    needs: 'promote',
    uses: './.github/workflows/desktop-release.yml',
    with: {
      ref: '${{ needs.promote.outputs.tag }}',
      tag: '${{ needs.promote.outputs.tag }}',
    },
    secrets: 'inherit',
  })
})
