import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveCurrency } from '../lib/currency'
import type { SiteCurrency } from '../types'

const currencies: SiteCurrency[] = [
  {
    name: 'Saudi Riyal',
    code: 'SAR',
    symbol: 'SAR',
    convertRate: 1,
    isBase: true,
    locale: 'ar-SA',
    decimals: 2,
  },
  {
    name: 'US Dollar',
    code: 'USD',
    symbol: '$',
    convertRate: 0.27,
    isBase: false,
    locale: 'en-US',
    decimals: 2,
  },
]

test('currency: an offered cookie currency wins', () => {
  assert.equal(resolveCurrency(currencies, 'USD', 'SAR'), 'USD')
})

test('currency: an unknown or missing cookie falls back to the default', () => {
  assert.equal(resolveCurrency(currencies, 'EUR', 'SAR'), 'SAR')
  assert.equal(resolveCurrency(currencies, undefined, 'SAR'), 'SAR')
})
