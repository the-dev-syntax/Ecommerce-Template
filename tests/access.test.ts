import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isAdminOrOwner } from '../lib/access-shared'
import { deriveOrderStatus } from '../lib/orders/status'

test('access: the owner id is compared as a string', () => {
  assert.equal(
    isAdminOrOwner('507f1f77bcf86cd799439011', 'user', '507f1f77bcf86cd799439011'),
    true
  )
  assert.equal(
    isAdminOrOwner('507f1f77bcf86cd799439011', 'user', '507f1f77bcf86cd799439012'),
    false
  )
})

test('access: admins can open orders whose user was deleted', () => {
  assert.equal(isAdminOrOwner('admin-id', 'admin', null), true)
  assert.equal(isAdminOrOwner(undefined, 'admin', null), true)
  assert.equal(isAdminOrOwner('user-id', 'user', null), false)
})

test('orders: a delivered shipped order reports delivered', () => {
  const status = deriveOrderStatus({
    status: 'shipped',
    isDelivered: true,
  } as never)
  assert.equal(status, 'delivered')
})
