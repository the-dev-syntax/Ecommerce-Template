import assert from 'node:assert/strict'
import { test } from 'node:test'

import { firstPayPalCapture, isPayPalAlreadyCaptured } from '../lib/paypal'

test('paypal: the first capture is extracted from an order response', () => {
  const capture = firstPayPalCapture({
    purchase_units: [
      {
        payments: {
          captures: [
            {
              id: 'cap_1',
              status: 'COMPLETED',
              amount: { value: '100.00', currency_code: 'SAR' },
            },
          ],
        },
      },
    ],
  })

  assert.equal(capture?.id, 'cap_1')
  assert.equal(capture?.amount?.value, '100.00')
})

test('paypal: a response without a capture returns null', () => {
  assert.equal(firstPayPalCapture({ purchase_units: [] }), null)
  assert.equal(firstPayPalCapture(null), null)
})

test('paypal: ORDER_ALREADY_CAPTURED is detected', () => {
  assert.equal(
    isPayPalAlreadyCaptured({
      status: 422,
      message: '{"name":"ORDER_ALREADY_CAPTURED"}',
    }),
    true
  )
})

test('paypal: other 422 errors are not treated as already captured', () => {
  assert.equal(
    isPayPalAlreadyCaptured({
      status: 422,
      message: '{"name":"UNPROCESSABLE_ENTITY"}',
    }),
    false
  )
  assert.equal(
    isPayPalAlreadyCaptured({ status: 500, message: 'ORDER_ALREADY_CAPTURED' }),
    false
  )
})
