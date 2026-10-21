import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  calculateCancellationLines,
  calculateReturnLines,
  getRemainingQuantity,
  getShippingRefundAmount,
  toCreditNoteLines,
  type OrderItemForReturn,
} from '../lib/returns/calculations'
import { round2 } from '../lib/utils'

const items: OrderItemForReturn[] = [
  {
    clientId: 'a',
    product: 'p1',
    name: 'Returnable item',
    price: 57.5,
    quantity: 2,
    netPrice: 50,
    vatAmount: 15,
    vatPercent: 15,
    taxCategory: 'S',
    returnPolicy: 'return_and_refund',
    refundedQuantity: 0,
  },
  {
    clientId: 'b',
    product: 'p2',
    name: 'Refund-only item',
    price: 57.5,
    quantity: 1,
    netPrice: 50,
    vatAmount: 7.5,
    vatPercent: 15,
    taxCategory: 'S',
    returnPolicy: 'refund_only',
    refundedQuantity: 0,
  },
  {
    clientId: 'c',
    product: 'p3',
    name: 'Final-sale item',
    price: 230,
    quantity: 1,
    netPrice: 200,
    vatAmount: 30,
    vatPercent: 15,
    taxCategory: 'S',
    returnPolicy: 'final_sale',
    refundedQuantity: 0,
  },
]

const options = { taxInclusive: true, taxRate: 0.15 }

describe('calculateReturnLines', () => {
  it('calculates net, VAT and gross from the order snapshot', () => {
    const [line] = calculateReturnLines(
      items,
      [{ clientId: 'a', quantity: 1 }],
      'customer_return',
      options
    )

    assert.equal(line.netAmount, 50)
    assert.equal(line.vatAmount, 7.5)
    assert.equal(line.grossAmount, 57.5)
    assert.equal(line.returnPolicy, 'return_and_refund')
  })

  it('supports partial quantities and tracks the remaining quantity', () => {
    const [line] = calculateReturnLines(
      items,
      [{ clientId: 'a', quantity: 2 }],
      'customer_return',
      options
    )

    assert.equal(line.grossAmount, 115)
    assert.equal(getRemainingQuantity(items[0]), 2)

    const remainingItem = { ...items[0], refundedQuantity: 1 }
    assert.equal(getRemainingQuantity(remainingItem), 1)
  })

  it('blocks final-sale items for change-of-mind returns', () => {
    assert.throws(
      () =>
        calculateReturnLines(
          items,
          [{ clientId: 'c', quantity: 1 }],
          'customer_return',
          options
        ),
      /final sale/i
    )
  })

  it('allows final-sale overrides for defective or wrong items', () => {
    for (const reason of ['defective', 'wrong_item'] as const) {
      const [line] = calculateReturnLines(
        items,
        [{ clientId: 'c', quantity: 1 }],
        reason,
        options
      )
      assert.equal(line.returnPolicy, 'final_sale')
      assert.equal(line.grossAmount, 230)
    }
  })

  it('rejects quantities above the refunded remainder and duplicate items', () => {
    assert.throws(
      () =>
        calculateReturnLines(
          [{ ...items[0], refundedQuantity: 2 }],
          [{ clientId: 'a', quantity: 1 }],
          'customer_return',
          options
        ),
      /can still be refunded/
    )

    assert.throws(
      () =>
        calculateReturnLines(
          items,
          [
            { clientId: 'a', quantity: 1 },
            { clientId: 'a', quantity: 1 },
          ],
          'customer_return',
          options
        ),
      /Duplicate/
    )
  })

  it('creates refund-only lines without taxing shipping', () => {
    const [line] = calculateReturnLines(
      items,
      [{ clientId: 'b', quantity: 1 }],
      'customer_return',
      options
    )

    assert.equal(line.returnPolicy, 'refund_only')
    assert.equal(getShippingRefundAmount(10, 'customer_return', false), 0)
    assert.equal(round2(line.grossAmount), 57.5)
  })
})

describe('getShippingRefundAmount', () => {
  it('refunds shipping for defective/wrong-item returns only', () => {
    assert.equal(getShippingRefundAmount(10, 'defective', false), 10)
    assert.equal(getShippingRefundAmount(10, 'wrong_item', false), 10)
    assert.equal(getShippingRefundAmount(10, 'customer_return', false), 0)
    assert.equal(getShippingRefundAmount(10, 'other', false), 0)
  })

  it('never refunds shipping twice', () => {
    assert.equal(getShippingRefundAmount(10, 'defective', true), 0)
  })
})

describe('calculateCancellationLines', () => {
  it('refunds all remaining items, including final sale', () => {
    const lines = calculateCancellationLines(items, options)

    assert.equal(lines.length, 3)
    assert.equal(
      round2(lines.reduce((sum, line) => sum + line.grossAmount, 0)),
      402.5
    )
  })
})

describe('toCreditNoteLines', () => {
  it('names refund lines and keeps the net/VAT split', () => {
    const [line] = calculateReturnLines(
      items,
      [{ clientId: 'a', quantity: 1 }],
      'customer_return',
      options
    )
    const [noteLine] = toCreditNoteLines([line])

    assert.equal(noteLine.name, 'Refund - Returnable item')
    assert.equal(noteLine.lineTotal, 50)
    assert.equal(noteLine.vatAmount, 7.5)
    assert.equal(noteLine.unitPrice, 50)
    assert.equal(noteLine.quantity, 1)
  })
})
