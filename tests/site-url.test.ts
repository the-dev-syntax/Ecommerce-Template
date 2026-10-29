import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { getSiteUrl } from '../lib/env'

const keys = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SERVER_URL',
  'SITE_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
] as const

const saved = new Map<string, string | undefined>()

beforeEach(() => {
  for (const key of keys) {
    saved.set(key, process.env[key])
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of keys) {
    const value = saved.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

test('getSiteUrl: NEXT_PUBLIC_SITE_URL wins and is normalized', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://shop.example.com/'
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://legacy.example.com'
  assert.equal(getSiteUrl(), 'https://shop.example.com')
})

test('getSiteUrl: legacy server URL is an accepted fallback', () => {
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://legacy.example.com'
  assert.equal(getSiteUrl(), 'https://legacy.example.com')
})

test('getSiteUrl: explicit env wins over the provided fallback', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://env.example.com'
  assert.equal(
    getSiteUrl('https://setting.example.com'),
    'https://env.example.com'
  )
})

test('getSiteUrl: uses the fallback when no env is configured', () => {
  assert.equal(
    getSiteUrl('https://setting.example.com/'),
    'https://setting.example.com'
  )
})

test('getSiteUrl: last resort is localhost', () => {
  assert.equal(getSiteUrl(), 'http://localhost:3000')
})
