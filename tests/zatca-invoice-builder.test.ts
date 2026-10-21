import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { IInvoice } from '../lib/db/models/invoice.model'
import type { IZatcaSubmission } from '../lib/db/models/zatca.model'
import { buildZatcaInvoice } from '../lib/zatca/invoice-builder'

const previousHash = 'a'.repeat(44)

const seller = {
  legalNameEn: 'NAKAA ELSEHA MEDICAL PHARMACY',
  legalNameAr: 'صيدلية نقاء الصحة الطبية',
  vatNumber: '310161142300003',
  crNumber: '1185102259',
  nationalAddress: 'RFKB4744',
  street: 'King Fahd Road',
  buildingNumber: '1234',
  citySubdivision: 'Al Olaya',
  city: 'Riyadh',
  postalCode: '12211',
  country: 'SA',
}

function submission(overrides: Partial<IZatcaSubmission> = {}) {
  return {
    uuid: 'd6b1b5d0-8f1e-4b1a-9f6e-2d5f0a4c8e11',
    icv: 1,
    pih: previousHash,
    ...overrides,
  } as unknown as IZatcaSubmission
}

function invoice(overrides: Partial<IInvoice> = {}) {
  return {
    _id: 'invoice-1',
    number: 'NEM-26-000001',
    type: 'invoice',
    currency: 'SAR',
    issuedAt: new Date('2026-10-20T12:34:56Z'),
    seller,
    buyer: { name: 'Test Buyer' },
    items: [
      {
        name: 'Taxable product',
        quantity: 2,
        unitPrice: 50,
        lineTotal: 100,
        taxCategory: 'S',
        exemptionReasonCode: '',
        vatPercent: 15,
        vatAmount: 15,
      },
    ],
    itemsPrice: 100,
    shippingPrice: 10,
    vatAmount: 15,
    total: 125,
    qrPayload: '',
    ...overrides,
  } as unknown as IInvoice
}

describe('buildZatcaInvoice', () => {
  it('builds a B2C simplified tax invoice with net lines, VAT and non-taxable shipping', () => {
    const built = buildZatcaInvoice(invoice(), submission())

    assert.equal(built.invoiceTypeCode, '388')
    assert.equal(built.invoiceSubType, '0200000')
    assert.equal(built.documentCurrency, 'SAR')
    assert.equal(built.buyer, undefined)
    assert.equal(built.invoiceCounterValue, 1)
    assert.equal(built.previousInvoiceHash, previousHash)

    assert.equal(built.lines.length, 2)
    assert.equal(built.lines[0].unitPrice, 50)
    assert.equal(built.lines[0].lineTotal, 100)
    assert.equal(built.lines[1].vatCategory, 'O')
    assert.equal(built.lines[1].lineTotal, 10)

    assert.equal(built.lineExtensionAmount, 110)
    assert.equal(built.taxExclusiveAmount, 110)
    assert.equal(built.taxTotal, 15)
    assert.equal(built.taxInclusiveAmount, 125)
    assert.equal(built.payableAmount, 125)

    const standard = built.taxSubtotals.find((line) => line.taxCategory === 'S')
    const outOfScope = built.taxSubtotals.find((line) => line.taxCategory === 'O')
    assert.deepEqual(
      { taxableAmount: standard?.taxableAmount, taxAmount: standard?.taxAmount },
      { taxableAmount: 100, taxAmount: 15 }
    )
    assert.deepEqual(
      {
        taxableAmount: outOfScope?.taxableAmount,
        taxAmount: outOfScope?.taxAmount,
        code: outOfScope?.exemptionReasonCode,
      },
      { taxableAmount: 10, taxAmount: 0, code: 'VATEX-SA-OOS' }
    )

    assert.equal(built.issueDate, '2026-10-20')
    assert.match(built.issueTime, /^\d{2}:\d{2}:\d{2}$/)
  })

  it('builds a credit note that references the original invoice', () => {
    const built = buildZatcaInvoice(
      invoice({
        number: 'NEM-26-000002',
        type: 'credit_note',
        originalInvoiceNumber: 'NEM-26-000001',
        notes: 'Customer return',
        shippingPrice: 0,
        itemsPrice: 4.35,
        vatAmount: 0.65,
        total: 5,
        items: [
          {
            name: 'Refund - Taxable product',
            quantity: 1,
            unitPrice: 4.35,
            lineTotal: 4.35,
            taxCategory: 'S',
            exemptionReasonCode: '',
            vatPercent: 15,
            vatAmount: 0.65,
          },
          {
            name: 'Refund - Shipping',
            quantity: 1,
            unitPrice: 0,
            lineTotal: 0,
            taxCategory: 'O',
            exemptionReasonCode: '',
            vatPercent: 0,
            vatAmount: 0,
          },
        ],
      }),
      submission({ icv: 2, pih: 'b'.repeat(44) })
    )

    assert.equal(built.invoiceTypeCode, '381')
    assert.deepEqual(built.billingReference, { invoiceId: 'NEM-26-000001' })
    assert.equal(built.creditDebitReason, 'Customer return')
    assert.equal(built.lines.length, 1)
    assert.equal(built.payableAmount, 5)
    assert.equal(built.taxInclusiveAmount, 5)
  })

  it('allows the sandbox certificate VAT override without changing the snapshot', () => {
    const source = invoice()
    const built = buildZatcaInvoice(source, submission(), {
      sellerVatNumber: '399999999900003',
    })

    assert.equal(built.seller.vatNumber, '399999999900003')
    assert.equal(source.seller.vatNumber, '310161142300003')
  })

  it('requires an ICV and PIH before signing', () => {
    assert.throws(() =>
      buildZatcaInvoice(invoice(), submission({ icv: undefined }))
    )
    assert.throws(() =>
      buildZatcaInvoice(invoice(), submission({ pih: undefined }))
    )
  })
})
