import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as yaml from 'js-yaml'
import {
  addedLineNumbers,
  buildReviewRequest,
  collectReviewComments,
  extractResponseText,
  renderReviewBody,
} from './ai-review-pr.mjs'

test('maps only added lines from a unified patch', () => {
  const lines = addedLineNumbers([
    '@@ -10,3 +20,4 @@ function example()',
    ' context',
    '+added one',
    '-removed',
    '+added two',
    ' context',
  ].join('\n'))
  assert.deepEqual([...lines], [21, 22])
})

test('rejects hallucinated paths and unchanged lines before posting comments', () => {
  const result = collectReviewComments({
    findings: [
      { priority: 'P1', path: 'src/app.ts', line: 4, body: 'real' },
      { priority: 'P1', path: 'src/app.ts', line: 3, body: 'unchanged' },
      { priority: 'P2', path: 'missing.ts', line: 1, body: 'hallucinated' },
    ],
  }, [
    { filename: 'src/app.ts', patch: '@@ -3,1 +3,2 @@\n old\n+real\n+second\n' },
  ])
  assert.deepEqual(result.comments, [{
    path: 'src/app.ts',
    line: 4,
    side: 'RIGHT',
    body: '[P1] real',
  }])
  assert.equal(result.skipped.length, 2)
})

test('builds a strict structured-output request', () => {
  const request = buildReviewRequest({
    model: 'gpt-5.2-codex',
    reasoningEffort: 'medium',
    context: 'diff',
  })
  assert.equal(request.model, 'gpt-5.2-codex')
  assert.equal(request.store, false)
  assert.equal(request.reasoning.effort, 'medium')
  assert.equal(request.text.format.type, 'json_schema')
  assert.equal(request.text.format.strict, true)
  assert.equal(request.text.format.schema.properties.findings.type, 'array')
})

test('extracts text from both Responses API output shapes', () => {
  assert.equal(extractResponseText({ output_text: '{"summary":"ok"}' }), '{"summary":"ok"}')
  assert.equal(extractResponseText({
    output: [{ content: [{ type: 'output_text', text: '{"summary":"nested"}' }] }],
  }), '{"summary":"nested"}')
})

test('renders a readable advisory review body', () => {
  const body = renderReviewBody({
    summary: 'The change is focused.',
    decision: 'comment',
    findings: [{ priority: 'P2', path: 'src/app.ts', line: 4, body: 'Add a regression test.' }],
    tests: ['pnpm test'],
    notes: [],
  })
  assert.match(body, /mnh-ai-review/)
  assert.match(body, /src\/app\.ts:4/)
  assert.match(body, /pnpm test/)
})

test('keeps the GitHub workflow on the trusted pull_request_target boundary', () => {
  const root = resolve(import.meta.dirname, '..')
  const workflow = yaml.load(readFileSync(resolve(root, '.github/workflows/ai-pr-review.yml'), 'utf8'))
  assert.deepEqual(workflow.on.pull_request_target.types, ['opened', 'synchronize', 'reopened', 'ready_for_review'])
  assert.deepEqual(workflow.permissions, { contents: 'read', 'pull-requests': 'write' })
  const steps = workflow.jobs.review.steps
  const checkout = steps.find(step => step.name === 'Check out trusted default branch')
  assert.equal(checkout.with.ref, String.fromCharCode(36) + '{{ github.event.repository.default_branch }}')
  assert.equal(checkout.with['persist-credentials'], false)
  const review = steps.find(step => step.name === 'Review diff and publish GitHub review')
  assert.equal(review['continue-on-error'], true)
  assert.equal(review.run, 'node scripts/ai-review-pr.mjs')
  assert.match(review.env.GITHUB_TOKEN, /github\.token/)
  assert.match(review.env.AI_REVIEW_API_KEY, /secrets\.AI_REVIEW_API_KEY/)
  assert.match(review.env.AI_REVIEW_API_URL, /vars\.AI_REVIEW_API_URL/)
})
