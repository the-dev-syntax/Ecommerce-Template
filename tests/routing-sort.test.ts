import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DEFAULT_PRODUCT_SORT, isProductSort } from '../lib/constants'
import { localizedPath } from '../lib/utils'

test('isProductSort: accepts only whitelisted values', () => {
  assert.equal(isProductSort('best-selling'), true)
  assert.equal(isProductSort('newest-arrivals'), true)
  assert.equal(isProductSort('price-low-to-high'), true)
  assert.equal(isProductSort('nonsense'), false)
  assert.equal(isProductSort(''), false)
  assert.equal(isProductSort(undefined), false)
  assert.equal(isProductSort(null), false)
})

test('DEFAULT_PRODUCT_SORT is itself a valid sort option', () => {
  assert.equal(isProductSort(DEFAULT_PRODUCT_SORT), true)
})

test('localizedPath: prefixes only non-default locales', () => {
  assert.equal(localizedPath('en-US', '/sign-in'), '/sign-in')
  assert.equal(localizedPath('ar', '/sign-in'), '/ar/sign-in')
  assert.equal(localizedPath('fr', '/product/x'), '/fr/product/x')
})
