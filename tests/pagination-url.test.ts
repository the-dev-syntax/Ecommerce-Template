import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { buildUrlQuery } from '../lib/utils'

test('pagination keeps a locale-stripped path exactly once', () => {
  const url = buildUrlQuery({
    basePath: '/fr/search',
    params: 'page=1&category=T-Shirts',
    key: 'page',
    value: '2',
  })
  const parsed = new URL(url, 'https://example.com')

  assert.equal(parsed.pathname, '/fr/search')
  assert.equal(parsed.searchParams.get('page'), '2')
  assert.equal(parsed.searchParams.get('category'), 'T-Shirts')
})

test('pagination uses the locale-stripped pathname', () => {
  const source = readFileSync(
    join(process.cwd(), 'components', 'shared', 'pagination.tsx'),
    'utf8'
  )

  assert.match(source, /usePathname/)
  assert.match(source, /basePath:\s*pathname/)
})
