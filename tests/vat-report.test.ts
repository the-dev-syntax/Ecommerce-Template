import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { summarizeVatReport, type VatReportRow } from '../lib/reports/vat'

function row(
  type: 'invoice' | 'credit_note',
  net: number,
  vat: number,
  gross: number
): VatReportRow {
  return {
    id: type + net,
    number: type,
    type,
    issuedAt: new Date(),
    orderId: 'order',
    currency: 'SAR',
    net,
    vat,
    gross,
  }
}

describe('summarizeVatReport', () => {
  it('adds invoices and subtracts credit notes', () => {
    const summary = summarizeVatReport([
      row('invoice', 100, 15, 115),
      row('invoice', 200, 30, 230),
      row('credit_note', 40, 6, 46),
    ])

    assert.deepEqual(summary, {
      net: 260,
      vat: 39,
      gross: 299,
      invoices: 2,
      creditNotes: 1,
    })
  })
})
