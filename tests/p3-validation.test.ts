import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ProductInputSchema,
  ShippingAddressSchema,
  ShippingRateSchema,
} from '../lib/validator'
import { parseDateParam } from '../lib/utils'

const address = {
  fullName: 'Jane Doe',
  street: '1911 Prince Sultan St',
  city: 'Riyadh',
  province: 'Riyadh',
  postalCode: '12211',
  district: 'Al Olaya',
  nationalAddress: 'RFKB4744',
  phone: '+966 50 123 4567',
  country: 'Saudi Arabia',
}

test('ShippingAddressSchema: accepts a normal Saudi address', () => {
  assert.equal(ShippingAddressSchema.safeParse(address).success, true)
})

test('ShippingAddressSchema: rejects a non-phone phone number', () => {
  assert.equal(
    ShippingAddressSchema.safeParse({ ...address, phone: 'x' }).success,
    false
  )
  assert.equal(
    ShippingAddressSchema.safeParse({ ...address, phone: 'abcdefgh' }).success,
    false
  )
  // Too few digits.
  assert.equal(
    ShippingAddressSchema.safeParse({ ...address, phone: '12345' }).success,
    false
  )
})

test('ShippingAddressSchema: rejects malformed postal/national address', () => {
  assert.equal(
    ShippingAddressSchema.safeParse({ ...address, postalCode: '!!' }).success,
    false
  )
  assert.equal(
    ShippingAddressSchema.safeParse({ ...address, nationalAddress: 'RFKB!' })
      .success,
    false
  )
})

const shippingRate = {
  zoneName: 'Saudi Arabia',
  country: 'Saudi Arabia',
  region: '*',
  city: '*',
  carrier: 'SMSA',
  serviceName: 'Express',
  baseRate: 20,
  includedWeightKg: 1,
  extraPerKg: 5,
  weightRoundingKg: 0.5,
  freeShippingEnabled: true,
  freeShippingMinPrice: 200,
  codFee: 10,
  remoteSurcharge: 0,
  etaMinDays: 1,
  etaMaxDays: 3,
  pickupAvailable: false,
  codAvailable: true,
  isActive: true,
  priority: 0,
}

test('ShippingRateSchema: accepts a normal rate', () => {
  assert.equal(ShippingRateSchema.safeParse(shippingRate).success, true)
})

test('ShippingRateSchema: rejects etaMinDays > etaMaxDays', () => {
  assert.equal(
    ShippingRateSchema.safeParse({ ...shippingRate, etaMinDays: 5, etaMaxDays: 2 })
      .success,
    false
  )
})

test('ShippingRateSchema: rejects absurd monetary values', () => {
  assert.equal(
    ShippingRateSchema.safeParse({
      ...shippingRate,
      freeShippingMinPrice: 1_000_001,
    }).success,
    false
  )
})

test('ProductInputSchema: product weight is optional (seed data)', () => {
  const base = {
    name: 'Test product',
    slug: 'test-product',
    category: 'Test',
    images: ['/images/test.jpg'],
    brand: 'Test',
    description: 'Test description',
    isPublished: true,
    price: 10,
    listPrice: 12,
    countInStock: 5,
    tags: [],
    sizes: [],
    colors: [],
    avgRating: 0,
    numReviews: 0,
    ratingDistribution: [],
    reviews: [],
    numSales: 0,
  }
  assert.equal(ProductInputSchema.safeParse(base).success, true)
  assert.equal(
    ProductInputSchema.safeParse({ ...base, weight: 1.5 }).success,
    true
  )
})

test('parseDateParam: uses UTC day boundaries', () => {
  assert.equal(
    parseDateParam('2026-10-01', false)?.toISOString(),
    '2026-10-01T00:00:00.000Z'
  )
  assert.equal(
    parseDateParam('2026-10-01', true)?.toISOString(),
    '2026-10-01T23:59:59.999Z'
  )
  assert.equal(parseDateParam('not-a-date', false), undefined)
})
