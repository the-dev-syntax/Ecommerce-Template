import assert from 'node:assert/strict'
import { test } from 'node:test'

import { gatewayRefundCoversRequest } from '../lib/returns/refund-state'

test('refund state: a gateway refund that covers the recorded amount is complete', () => {
  assert.equal(
    gatewayRefundCoversRequest({
      gatewayRefunded: 100,
      recordedRefunded: 0,
      requested: 100,
    }),
    true
  )
  assert.equal(
    gatewayRefundCoversRequest({
      gatewayRefunded: 75,
      recordedRefunded: 25,
      requested: 50,
    }),
    true
  )
})

test('refund state: a missing or short gateway refund is not complete', () => {
  assert.equal(
    gatewayRefundCoversRequest({
      gatewayRefunded: 40,
      recordedRefunded: 0,
      requested: 100,
    }),
    false
  )
  assert.equal(
    gatewayRefundCoversRequest({
      gatewayRefunded: 0,
      recordedRefunded: 0,
      requested: 100,
    }),
    false
  )
})
