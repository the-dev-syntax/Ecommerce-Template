import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatError } from '../lib/utils'

const generic = 'Something went wrong. Please try again.'

test('formatError: keeps short domain errors actionable', () => {
  assert.equal(
    formatError(new Error('Not enough stock to reserve this order')),
    'Not enough stock to reserve this order'
  )
  assert.equal(
    formatError(new Error('Shipping is not available for this address')),
    'Shipping is not available for this address'
  )
})

test('formatError: hides driver, connection and stack details', () => {
  assert.equal(
    formatError({
      name: 'CastError',
      message: 'Cast to ObjectId failed for value "abc" at path "_id"',
    }),
    generic
  )
  assert.equal(
    formatError(
      new Error('MongoServerError: connect ECONNREFUSED mongodb://db.internal')
    ),
    generic
  )
  assert.equal(
    formatError(
      new Error('Error: boom\n    at handler (/srv/app/lib/actions/x.ts:12:3)')
    ),
    generic
  )
})

test('formatError: keeps validation and duplicate-key messages', () => {
  assert.equal(
    formatError({
      name: 'ValidationError',
      errors: { email: { message: 'Email is required' } },
    }),
    'Email is required'
  )
  assert.equal(
    formatError({ code: 11000, keyValue: { email: 'a@b.c' } }),
    'email already exists'
  )
})
