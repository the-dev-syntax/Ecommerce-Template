import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hasPendingEmailChange } from '../lib/email-change'

const now = new Date('2026-11-01T12:00:00.000Z')

test('email change: a valid pending address keeps the OTP screen open', () => {
  assert.equal(
    hasPendingEmailChange(
      {
        pendingEmail: 'new@example.com',
        pendingEmailExpires: new Date('2026-11-01T12:30:00.000Z'),
      },
      now
    ),
    true
  )
})

test('email change: an expired pending address is not open', () => {
  assert.equal(
    hasPendingEmailChange(
      {
        pendingEmail: 'new@example.com',
        pendingEmailExpires: new Date('2026-11-01T11:59:00.000Z'),
      },
      now
    ),
    false
  )
})

test('email change: no pending address means no pending change', () => {
  assert.equal(hasPendingEmailChange(null, now), false)
  assert.equal(hasPendingEmailChange({}, now), false)
})
