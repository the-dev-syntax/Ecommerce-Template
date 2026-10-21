import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  allocateRefundToLines,
  type CreditNoteSourceLine,
} from '../lib/invoices/credit-note'
import { round2 } from '../lib/utils'

const lines: CreditNoteSourceLine[] = [
  {
    name: 'Taxable product',
    lineTotal: 100,
    vatAmount: 15,
    taxCategory: 'S',
    vatPercent: 15,
  },
  {
    name: 'Zero-rated product',
    lineTotal: 30,
    vatAmount: 0,
    taxCategory: 'Z',
    vatPercent: 0,
  },
  {
    name: 'Shipping',
    lineTotal: 10,
    vatAmount: 0,
    taxCategory: 'O',
    vatPercent: 0,
  },
]

const originalTotal = 155

function totals(allocated: ReturnType<typeof allocateRefundToLines>) {
  return {
    net: round2(allocated.reduce((sum, line) => sum + line.lineTotal, 0)),
    vat: round2(allocated.reduce((sum, line) => sum + line.vatAmount, 0)),
    gross: round2(
      allocated.reduce(
        (sum, line) => sum + line.lineTotal + line.vatAmount,
        0
      )
    ),
  }
}

describe('allocateRefundToLines', () => {
  it('reproduces the original invoice for a full refund', () => {
    const allocated = allocateRefundToLines(lines, originalTotal, originalTotal)

    assert.deepEqual(totals(allocated), { net: 140, vat: 15, gross: 155 })

    const taxable = allocated.find((line) => line.name === 'Refund - Taxable product')
    assert.ok(taxable)
    assert.equal(taxable.lineTotal, 100)
    assert.equal(taxable.vatAmount, 15)
    assert.equal(taxable.unitPrice, taxable.lineTotal)

    const zeroRated = allocated.find(
      (line) => line.name === 'Refund - Zero-rated product'
    )
    assert.ok(zeroRated)
    assert.equal(zeroRated.vatAmount, 0)

    const shipping = allocated.find((line) => line.name === 'Refund - Shipping')
    assert.ok(shipping)
    assert.equal(shipping.taxCategory, 'O')
    assert.equal(shipping.vatAmount, 0)
  })

  it('allocates a partial refund exactly, including cents', () => {
    for (const refund of [5, 0.01, 0.03, 33.33, 77.77, 154.99]) {
      const allocated = allocateRefundToLines(lines, refund, originalTotal)
      assert.deepEqual(totals(allocated).gross, round2(refund), `refund ${refund}`)
      assert.ok(allocated.every((line) => line.lineTotal >= 0))
      assert.ok(allocated.every((line) => line.vatAmount >= 0))
    }
  })

  it('never applies VAT to non-taxable lines', () => {
    const allocated = allocateRefundToLines(lines, 50, originalTotal)

    for (const line of allocated.filter((item) => item.taxCategory !== 'S')) {
      assert.equal(line.vatAmount, 0)
      assert.equal(line.vatPercent, 0)
    }
  })

  it('clamps a refund above the original total', () => {
    const allocated = allocateRefundToLines(lines, 999, originalTotal)

    assert.deepEqual(totals(allocated).gross, originalTotal)
  })

  it('drops lines that receive no refund amount', () => {
    const allocated = allocateRefundToLines(lines, 0.01, originalTotal)

    assert.equal(allocated.length, 1)
    assert.deepEqual(totals(allocated).gross, 0.01)
  })

  it('rejects zero or negative refunds and empty invoices', () => {
    assert.throws(() => allocateRefundToLines(lines, 0, originalTotal))
    assert.throws(() => allocateRefundToLines(lines, -1, originalTotal))
    assert.throws(() => allocateRefundToLines([], 1, 0))
  })
})
