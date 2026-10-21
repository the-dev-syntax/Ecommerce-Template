import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { priceLine, priceOrderItems } from '../lib/tax'

describe('priceLine', () => {
  it('derives net and VAT from a VAT-inclusive gross price', () => {
    const priced = priceLine({ price: 115, quantity: 1 }, 0.15, true)

    assert.equal(priced.grossLineTotal, 115)
    assert.equal(priced.unitNetPrice, 100)
    assert.equal(priced.netLineTotal, 100)
    assert.equal(priced.vatAmount, 15)
    assert.equal(priced.vatPercent, 15)
  })

  it('keeps the printed unit price and line total consistent for quantity > 1', () => {
    const priced = priceLine({ price: 57.5, quantity: 2 }, 0.15, true)

    assert.equal(priced.grossLineTotal, 115)
    assert.equal(priced.unitNetPrice, 50)
    assert.equal(priced.netLineTotal, 100)
    assert.equal(priced.vatAmount, 15)
  })

  it('adds VAT on top of a net price when pricing is exclusive', () => {
    const priced = priceLine({ price: 100, quantity: 2 }, 0.15, false)

    assert.equal(priced.netLineTotal, 200)
    assert.equal(priced.vatAmount, 30)
    assert.equal(priced.grossLineTotal, 230)
  })

  it('does not tax non-S categories and shipping-like lines', () => {
    for (const taxCategory of ['Z', 'E', 'O'] as const) {
      const priced = priceLine({ price: 99.99, quantity: 3, taxCategory }, 0.15, true)

      assert.equal(priced.vatAmount, 0)
      assert.equal(priced.netLineTotal, 299.97)
      assert.equal(priced.grossLineTotal, 299.97)
      assert.equal(priced.vatPercent, 0)
    }
  })

  it('treats a missing category as the standard 15% category', () => {
    const priced = priceLine({ price: 11.5, quantity: 1 }, 0.15, true)

    assert.equal(priced.unitNetPrice, 10)
    assert.equal(priced.vatAmount, 1.5)
  })

  it('rounds half cents consistently to two decimals', () => {
    const priced = priceLine({ price: 0.01, quantity: 1 }, 0.15, true)

    assert.equal(priced.unitNetPrice, 0.01)
    assert.equal(priced.netLineTotal, 0.01)
    assert.equal(priced.vatAmount, 0)
  })
})

describe('priceOrderItems', () => {
  it('snapshots category, net price and VAT on each order item', () => {
    const [taxable, exempt] = priceOrderItems(
      [
        { price: 115, quantity: 2 },
        { price: 50, quantity: 1, taxCategory: 'Z' as const },
      ],
      0.15,
      true
    )

    assert.deepEqual(
      {
        taxCategory: taxable.taxCategory,
        netPrice: taxable.netPrice,
        vatAmount: taxable.vatAmount,
        vatPercent: taxable.vatPercent,
      },
      { taxCategory: 'S', netPrice: 100, vatAmount: 30, vatPercent: 15 }
    )
    assert.deepEqual(
      {
        taxCategory: exempt.taxCategory,
        netPrice: exempt.netPrice,
        vatAmount: exempt.vatAmount,
        vatPercent: exempt.vatPercent,
      },
      { taxCategory: 'Z', netPrice: 50, vatAmount: 0, vatPercent: 0 }
    )
  })
})
