import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as yaml from 'js-yaml'
import { test } from 'node:test'

const repositoryRoot = join(import.meta.dirname, '../..')

test('promote workflow creates a PR first and releases only after main receives the merge', () => {
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
    push: {
      branches: ['main'],
    },
  })
  assert.deepEqual(workflow.permissions, { contents: 'write', 'pull-requests': 'write' })

  const createPr = workflow.jobs['create-promotion-pr']
  assert.equal(createPr.if, "github.event_name == 'workflow_dispatch'")
  assert.equal(createPr['runs-on'], 'ubuntu-24.04')
  assert.equal(createPr.steps[0].if, "github.ref != 'refs/heads/dev'")

  const checkout = createPr.steps.find(step => step.uses === 'actions/checkout@v6')
  assert.deepEqual(checkout.with, {
    ref: 'dev',
    'fetch-depth': 0,
    'persist-credentials': false,
  })

  const verify = createPr.steps.find(step => step.name === 'Verify the existing dev commit is release-ready')
  assert.equal(verify.run.includes('desktop-release.mjs'), true)

  const create = createPr.steps.find(step => step.name === 'Create or update the promotion PR')
  assert.equal(create.run.includes('gh pr create'), true)
  assert.equal(create.run.includes('gh pr edit'), true)
  assert.equal(create.run.includes('git push'), false)
  assert.equal(create.run.includes('git commit'), false)

  const release = workflow.jobs['release-after-merge']
  assert.equal(release.if, "github.event_name == 'push' && github.ref == 'refs/heads/main'")
  const findPromotion = release.steps.find(step => step.name === 'Find the merged dev promotion PR')
  assert.equal(findPromotion.run.includes('commits/$MERGE_SHA/pulls'), true)
  const tag = release.steps.find(step => step.name === 'Create the release tag on the merged main commit')
  assert.equal(tag.run.includes('git push origin "$TAG"'), true)

  const publish = workflow.jobs['publish-windows-release']
  assert.equal(publish.if, "needs.release-after-merge.outputs.enabled == 'true'")
  assert.equal(publish.needs, 'release-after-merge')
  assert.equal(publish.uses, './.github/workflows/desktop-release.yml')
  assert.deepEqual(publish.with, {
    ref: '${{ needs.release-after-merge.outputs.merge_sha }}',
    tag: '${{ needs.release-after-merge.outputs.tag }}',
    publish: true,
  })
})
