import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isFullyRefunded } from '../lib/orders/status'

test('refund status: the refunded status is terminal', () => {
  assert.equal(isFullyRefunded({ status: 'refunded' }), true)
})

test('refund status: a full refunded amount is terminal', () => {
  assert.equal(
    isFullyRefunded({ status: 'paid', totalPrice: 100, refundedAmount: 100 }),
    true
  )
  assert.equal(
    isFullyRefunded({ status: 'paid', totalPrice: 100, refundedAmount: 99.99 }),
    true
  )
})

test('refund status: partial and zero-total orders are not fully refunded', () => {
  assert.equal(
    isFullyRefunded({ status: 'paid', totalPrice: 100, refundedAmount: 50 }),
    false
  )
  assert.equal(
    isFullyRefunded({ status: 'paid', totalPrice: 0, refundedAmount: 0 }),
    false
  )
})
