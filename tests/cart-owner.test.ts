import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveCartOwnerAction } from '../lib/cart-owner'

test('cart owner: the same owner keeps the cart', () => {
  assert.equal(resolveCartOwnerAction('user-a', 'user-a'), 'keep')
  assert.equal(resolveCartOwnerAction(undefined, undefined), 'keep')
})

test('cart owner: a guest claiming a cart keeps it across sign-in', () => {
  assert.equal(resolveCartOwnerAction(undefined, 'user-a'), 'claim')
})

test('cart owner: a different account clears the cart', () => {
  assert.equal(resolveCartOwnerAction('user-a', 'user-b'), 'clear')
})

test('cart owner: a disappearing owner clears the cart', () => {
  assert.equal(resolveCartOwnerAction('user-a', undefined), 'clear')
})
