import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  calculateShippingPrice,
  shippingCountryMatches,
  shippingLocationMatches,
} from '../lib/shipping/rates'

const baseRate = {
  baseRate: 20,
  includedWeightKg: 1,
  extraPerKg: 5,
  weightRoundingKg: 1,
  freeShippingMinPrice: 200,
  remoteSurcharge: 0,
}

test('shipping: included weight is free above the base rate', () => {
  assert.equal(calculateShippingPrice(baseRate, 1, 100), 20)
})

test('shipping: extra weight is rounded up and charged per kg', () => {
  assert.equal(calculateShippingPrice(baseRate, 1.2, 100), 25)
  assert.equal(calculateShippingPrice(baseRate, 2.1, 100), 30)
})

test('shipping: a zero-weight legacy item only pays the base rate', () => {
  assert.equal(calculateShippingPrice(baseRate, 0, 100), 20)
})

test('shipping: the free-shipping threshold waives the whole rate', () => {
  assert.equal(calculateShippingPrice(baseRate, 4, 200), 0)
  assert.equal(calculateShippingPrice(baseRate, 4, 199.99), 35)
})

test('shipping: a remote surcharge is added to the rate', () => {
  assert.equal(
    calculateShippingPrice({ ...baseRate, remoteSurcharge: 15 }, 1, 100),
    35
  )
})

test('shipping: fractional rounding uses the configured step', () => {
  const halfKg = { ...baseRate, weightRoundingKg: 0.5 }
  assert.equal(calculateShippingPrice(halfKg, 1.2, 100), 22.5)
  assert.equal(calculateShippingPrice(halfKg, 1.6, 100), 25)
})

test('shipping: country aliases and wildcards match', () => {
  assert.equal(shippingCountryMatches('Saudi Arabia', 'SA'), true)
  assert.equal(shippingCountryMatches('KSA', 'Saudi Arabia'), true)
  assert.equal(shippingCountryMatches('Saudi Arabia', '*'), true)
  assert.equal(shippingCountryMatches('United Arab Emirates', 'SA'), false)
})

test('shipping: city matching is case-insensitive and supports wildcards', () => {
  assert.equal(shippingLocationMatches(' Riyadh ', 'riyadh'), true)
  assert.equal(shippingLocationMatches('Jeddah', '*'), true)
  assert.equal(shippingLocationMatches('Jeddah', 'Riyadh'), false)
})
