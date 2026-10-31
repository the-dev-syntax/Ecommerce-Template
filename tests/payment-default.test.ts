import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveDefaultPaymentMethod } from '../lib/payments'

test('payments: the configured default wins when it is enabled', () => {
  assert.equal(
    resolveDefaultPaymentMethod(
      [{ name: 'Moyasar' }, { name: 'Cash On Delivery' }],
      'Cash On Delivery'
    ),
    'Cash On Delivery'
  )
})

test('payments: a disabled configured default falls back to the first enabled method', () => {
  assert.equal(
    resolveDefaultPaymentMethod([{ name: 'Moyasar' }], 'Cash On Delivery'),
    'Moyasar'
  )
})

test('payments: no enabled methods keeps the configured value', () => {
  assert.equal(resolveDefaultPaymentMethod([], 'Moyasar'), 'Moyasar')
  assert.equal(resolveDefaultPaymentMethod([]), '')
})
