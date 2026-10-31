import assert from 'node:assert/strict'
import { test } from 'node:test'

import { remainingRestockQuantity } from '../lib/orders/restock'

test('restock: an untouched line returns its full quantity', () => {
  assert.equal(remainingRestockQuantity({ quantity: 3 }), 3)
  assert.equal(remainingRestockQuantity({ quantity: 3, restockedQuantity: 0 }), 3)
})

test('restock: a dashboard-refunded line returns zero', () => {
  assert.equal(
    remainingRestockQuantity({ quantity: 3, restockedQuantity: 3 }),
    0
  )
})

test('restock: a partially restocked line returns only the remainder', () => {
  assert.equal(
    remainingRestockQuantity({ quantity: 5, restockedQuantity: 2 }),
    3
  )
})

test('restock: an over-restocked line never goes negative', () => {
  assert.equal(
    remainingRestockQuantity({ quantity: 2, restockedQuantity: 5 }),
    0
  )
})
