import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pickClientIp } from '../lib/client-ip'
import User from '../lib/db/models/user.model'

function getHeader(map: Record<string, string>) {
  return (name: string) => map[name.toLowerCase()] ?? null
}

test('client ip: an explicitly trusted header wins', () => {
  const ip = pickClientIp(
    getHeader({
      'cf-connecting-ip': '203.0.113.9',
      'x-real-ip': '198.51.100.4',
    }),
    'CF-Connecting-IP'
  )
  assert.equal(ip, '203.0.113.9')
})

test('client ip: the right-most X-Forwarded-For value is used', () => {
  const ip = pickClientIp(
    getHeader({
      'x-forwarded-for': '1.2.3.4, 198.51.100.7',
    })
  )
  assert.equal(ip, '198.51.100.7')
})

test('client ip: returns null when no proxy header exists', () => {
  assert.equal(pickClientIp(getHeader({ 'user-agent': 'browser' })), null)
})

test('user email has a case-insensitive unique index', () => {
  const indexes = User.schema.indexes()
  const emailIndex = indexes.find(
    ([fields, options]) =>
      fields.email === 1 &&
      options.unique === true &&
      options.collation?.strength === 2
  )
  assert.ok(emailIndex, 'expected a unique email index with strength 2')
})
