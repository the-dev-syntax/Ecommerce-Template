import assert from 'node:assert/strict'
import { test } from 'node:test'

import { safeCallbackUrl } from '../lib/utils'

test('safeCallbackUrl: keeps same-origin relative paths', () => {
  assert.equal(safeCallbackUrl('/checkout'), '/checkout')
  assert.equal(safeCallbackUrl('/product/x?color=Red'), '/product/x?color=Red')
  assert.equal(safeCallbackUrl('/search?q=shoe&page=2'), '/search?q=shoe&page=2')
})

test('safeCallbackUrl: rejects external and malformed targets', () => {
  assert.equal(safeCallbackUrl(undefined), '/')
  assert.equal(safeCallbackUrl(null), '/')
  assert.equal(safeCallbackUrl(''), '/')
  assert.equal(safeCallbackUrl('https://evil.example/steal'), '/')
  assert.equal(safeCallbackUrl('//evil.example/steal'), '/')
  assert.equal(safeCallbackUrl('/\\evil.example/steal'), '/')
  assert.equal(safeCallbackUrl('javascript:alert(1)'), '/')
})
