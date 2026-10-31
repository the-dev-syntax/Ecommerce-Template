import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  RECOVERY_MAX_ATTEMPTS,
  RECOVERY_STALE_PROCESSING_MS,
  canClaimRecovery,
  isRetryableRecoveryError,
  normalizedProvider,
  paypalRequestId,
  recoveryFailureOutcome,
  recoveryRefundKey,
} from '../lib/orders/payment-recovery-state'
import { ORDER_STATUSES, deriveOrderStatus } from '../lib/orders/status'

test('payment recovery: key is stable per order/payment and distinct across pairs', () => {
  assert.equal(
    recoveryRefundKey('order-1', 'pi_1'),
    recoveryRefundKey('order-1', 'pi_1')
  )
  assert.notEqual(
    recoveryRefundKey('order-1', 'pi_1'),
    recoveryRefundKey('order-1', 'pi_2')
  )
  assert.notEqual(
    recoveryRefundKey('order-1', 'pi_1'),
    recoveryRefundKey('order-2', 'pi_1')
  )
})

test('payment recovery: provider labels normalize to adapter ids', () => {
  assert.equal(normalizedProvider('Stripe'), 'stripe')
  assert.equal(normalizedProvider('PayPal'), 'paypal')
  assert.equal(normalizedProvider('Moyasar'), 'moyasar')
  assert.equal(normalizedProvider('Cash On Delivery'), 'cod')
})

test('payment recovery: transient and unknown errors are retryable', () => {
  assert.equal(isRetryableRecoveryError({ status: 429 }), true)
  assert.equal(isRetryableRecoveryError({ statusCode: 503 }), true)
  assert.equal(isRetryableRecoveryError(new Error('fetch failed')), true)
  assert.equal(isRetryableRecoveryError(new Error('socket hang up')), true)
  assert.equal(isRetryableRecoveryError(new Error('unknown')), true)
})

test('payment recovery: definitive gateway/client errors are not retried', () => {
  assert.equal(isRetryableRecoveryError({ status: 400 }), false)
  assert.equal(isRetryableRecoveryError({ status: 401 }), false)
  assert.equal(isRetryableRecoveryError({ status: 422 }), false)
})

test('payment recovery: a concurrent duplicate cannot claim an active refund', () => {
  const key = recoveryRefundKey('order-1', 'pi_1')
  const now = new Date('2026-01-01T12:00:00Z')
  assert.equal(
    canClaimRecovery(
      {
        status: 'refund_pending',
        recoveryRefundKey: key,
        recoveryRefundStatus: 'processing',
        recoveryRefundAttempts: 1,
        recoveryRefundLastAttemptAt: new Date(now.getTime() - 1000),
      },
      key,
      now
    ),
    false
  )
  assert.equal(
    canClaimRecovery(
      {
        status: 'refund_pending',
        recoveryRefundKey: key,
        recoveryRefundStatus: 'processing',
        recoveryRefundAttempts: 1,
        recoveryRefundLastAttemptAt: new Date(
          now.getTime() - RECOVERY_STALE_PROCESSING_MS - 1
        ),
      },
      key,
      now
    ),
    true
  )
})

test('payment recovery: pending, mismatched and exhausted claims are handled', () => {
  const key = recoveryRefundKey('order-1', 'pi_1')
  assert.equal(canClaimRecovery({}, key), true)
  assert.equal(
    canClaimRecovery(
      {
        status: 'refund_pending',
        recoveryRefundKey: key,
        recoveryRefundStatus: 'pending',
        recoveryRefundAttempts: 1,
      },
      key
    ),
    true
  )
  assert.equal(
    canClaimRecovery(
      {
        status: 'refund_pending',
        recoveryRefundKey: recoveryRefundKey('order-1', 'pi_2'),
        recoveryRefundStatus: 'pending',
      },
      key
    ),
    false
  )
  assert.equal(
    canClaimRecovery(
      {
        status: 'refund_pending',
        recoveryRefundKey: key,
        recoveryRefundStatus: 'pending',
        recoveryRefundAttempts: RECOVERY_MAX_ATTEMPTS,
      },
      key
    ),
    false
  )
  assert.equal(
    canClaimRecovery({ status: 'refunded', totalPrice: 100, refundedAmount: 100 }, key),
    false
  )
  assert.equal(
    canClaimRecovery({ status: 'manual_review' }, key),
    false
  )
})

test('payment recovery: retries stop at the attempt cap and escalate', () => {
  assert.equal(recoveryFailureOutcome(true, 1), 'pending')
  assert.equal(
    recoveryFailureOutcome(true, RECOVERY_MAX_ATTEMPTS - 1),
    'pending'
  )
  assert.equal(
    recoveryFailureOutcome(true, RECOVERY_MAX_ATTEMPTS),
    'manual_review'
  )
  assert.equal(recoveryFailureOutcome(false, 1), 'manual_review')
})

test('payment recovery: PayPal request id is stable and within the 38-char cap', () => {
  const key = recoveryRefundKey('order-1', 'capture-1')
  const first = paypalRequestId(key)
  assert.equal(first, paypalRequestId(key))
  assert.equal(first.length, 38)
  assert.notEqual(first, paypalRequestId(recoveryRefundKey('order-2', 'capture-1')))
})

test('order statuses expose refund_pending and manual_review', () => {
  assert.ok(ORDER_STATUSES.includes('refund_pending'))
  assert.ok(ORDER_STATUSES.includes('manual_review'))
  assert.equal(
    deriveOrderStatus({
      status: 'refund_pending',
      isPaid: true,
      isDelivered: false,
    } as never),
    'refund_pending'
  )
  assert.equal(
    deriveOrderStatus({
      status: 'manual_review',
      isPaid: true,
      isDelivered: false,
    } as never),
    'manual_review'
  )
})
