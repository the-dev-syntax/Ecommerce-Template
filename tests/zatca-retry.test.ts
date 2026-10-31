import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ZATCA_MAX_ATTEMPTS,
  isZatcaRetryDue,
  nextZatcaRetryAt,
  zatcaRetryDelayMs,
} from '../lib/zatca/retry'

test('zatca: retry delays grow and stop at the attempt cap', () => {
  assert.equal(zatcaRetryDelayMs(1), 60_000)
  assert.equal(zatcaRetryDelayMs(2), 5 * 60_000)
  assert.equal(zatcaRetryDelayMs(3), 15 * 60_000)
  assert.equal(zatcaRetryDelayMs(4), 60 * 60_000)
  assert.equal(zatcaRetryDelayMs(5), 6 * 60 * 60_000)
  assert.equal(zatcaRetryDelayMs(ZATCA_MAX_ATTEMPTS), null)
  assert.equal(zatcaRetryDelayMs(ZATCA_MAX_ATTEMPTS + 1), null)
})

test('zatca: the next attempt is calculated from the current time', () => {
  const now = new Date('2026-01-01T12:00:00.000Z')
  assert.equal(
    nextZatcaRetryAt(1, now)?.toISOString(),
    '2026-01-01T12:01:00.000Z'
  )
  assert.equal(nextZatcaRetryAt(ZATCA_MAX_ATTEMPTS, now), null)
})

test('zatca: submissions are due when they have no schedule or the time passed', () => {
  const now = new Date('2026-01-01T12:00:00.000Z')
  assert.equal(isZatcaRetryDue(undefined, now), true)
  assert.equal(isZatcaRetryDue(null, now), true)
  assert.equal(isZatcaRetryDue(new Date('2026-01-01T11:59:00.000Z'), now), true)
  assert.equal(isZatcaRetryDue(new Date('2026-01-01T12:01:00.000Z'), now), false)
})
