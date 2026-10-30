import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  SESSION_MAX_AGE_SECONDS,
  checkTokenVersion,
  isSessionRevoked,
  revokedSessionKey,
  revokeSession,
  sessionRevocationTtl,
  type SessionStore,
} from '../lib/session-revocation'

class FakeStore implements SessionStore {
  values = new Map<string, { value: string; ex: number }>()
  failGet = false
  failSet = false

  async set(key: string, value: string, opts: { ex: number }) {
    if (this.failSet) throw new Error('store unavailable')
    this.values.set(key, { value, ex: opts.ex })
  }

  async get(key: string) {
    if (this.failGet) throw new Error('store unavailable')
    return this.values.get(key)?.value ?? null
  }
}

test('session revocation: a revoked sid is found by the next check', async () => {
  const store = new FakeStore()
  await revokeSession('sid-1', undefined, store)

  assert.equal(await isSessionRevoked('sid-1', store), true)
  assert.equal(await isSessionRevoked('sid-2', store), false)
  assert.equal(store.values.get(revokedSessionKey('sid-1'))?.ex, SESSION_MAX_AGE_SECONDS)
})

test('session revocation: store failures fail open', async () => {
  const store = new FakeStore()
  store.failSet = true
  await revokeSession('sid-1', undefined, store)

  store.failGet = true
  assert.equal(await isSessionRevoked('sid-1', store), false)
})

test('session revocation: TTL follows the token and is capped', () => {
  const now = 1_700_000_000
  assert.equal(sessionRevocationTtl(now + 60, now), 60)
  assert.equal(sessionRevocationTtl(now + SESSION_MAX_AGE_SECONDS * 2, now), SESSION_MAX_AGE_SECONDS)
  assert.equal(sessionRevocationTtl(now - 60, now), 1)
})

test('session revocation: token versions distinguish adopt, valid and revoked', () => {
  assert.equal(checkTokenVersion(undefined, 3), 'adopt')
  assert.equal(checkTokenVersion(3, 3), 'valid')
  assert.equal(checkTokenVersion(3, undefined), 'revoked')
  assert.equal(checkTokenVersion(2, 3), 'revoked')
})
