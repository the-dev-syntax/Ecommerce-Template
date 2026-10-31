import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

test('email templates never build links from the stored site.url', () => {
  const emailsDir = join(process.cwd(), 'emails')
  const offenders = readdirSync(emailsDir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
    .filter((file) =>
      readFileSync(join(emailsDir, file), 'utf8').includes('site.url')
    )

  assert.deepEqual(offenders, [])
})

test('password-reset links use the canonical site URL resolver', () => {
  const source = readFileSync(
    join(process.cwd(), 'lib', 'actions', 'user.actions.ts'),
    'utf8'
  )

  assert.match(source, /getSiteUrl\(\)/)
  assert.doesNotMatch(source, /site\.url/)
})
