import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  moyasarRecordedPaymentId,
  moyasarRefundableAmount,
} from '../lib/payments/moyasar'

test('moyasar: the recorded payment id prefers the explicit field', () => {
  assert.equal(
    moyasarRecordedPaymentId({
      moyasarPaymentId: 'pay_1',
      paymentResult: { id: 'pay_2' },
    }),
    'pay_1'
  )
  assert.equal(
    moyasarRecordedPaymentId({ paymentResult: { id: 'pay_2' } }),
    'pay_2'
  )
  assert.equal(moyasarRecordedPaymentId({}), '')
})

test('moyasar: the refundable amount subtracts prior refunds', () => {
  assert.equal(moyasarRefundableAmount({ amount: 10000 }), 100)
  assert.equal(moyasarRefundableAmount({ amount: 10000, refunded: 2500 }), 75)
  assert.equal(moyasarRefundableAmount({ amount: 10000, refunded: 10000 }), 0)
  assert.equal(moyasarRefundableAmount({ amount: 10000, refunded: 12000 }), 0)
})
