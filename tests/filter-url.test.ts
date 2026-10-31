import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getFilterUrl } from '../lib/utils'

function parsed(url: string) {
  return new URL(url, 'https://example.com')
}

test('filters reset the page number', () => {
  const url = parsed(
    getFilterUrl({
      params: { page: '2', category: 'all', sort: 'best-seller' },
      category: 'T-Shirts',
    })
  )

  assert.equal(url.pathname, '/search')
  assert.equal(url.searchParams.get('category'), 'T-Shirts')
  assert.equal(url.searchParams.get('page'), null)
})

test('sorting resets the page number', () => {
  const url = parsed(
    getFilterUrl({
      params: { page: '3', category: 'T-Shirts' },
      sort: 'price-low',
    })
  )

  assert.equal(url.pathname, '/search')
  assert.equal(url.searchParams.get('page'), null)
  assert.equal(url.searchParams.get('sort'), 'price-low')
})

test('an explicit page is preserved when no filter changes', () => {
  const url = parsed(
    getFilterUrl({
      params: { page: '2', category: 'T-Shirts' },
      page: '3',
    })
  )

  assert.equal(url.searchParams.get('page'), '3')
})
