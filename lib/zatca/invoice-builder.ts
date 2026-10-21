import type { Invoice, TaxSubtotal, VATCategory } from 'zatca-sdk'

import type { IInvoice } from '@/lib/db/models/invoice.model'
import type { IZatcaSubmission } from '@/lib/db/models/zatca.model'
import { round2 } from '@/lib/utils'

function dateParts(date: Date, timeZone = 'Asia/Riyadh') {
  const dateText = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const timeText = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)

  return { issueDate: dateText, issueTime: timeText }
}

function groupTaxSubtotals(invoice: IInvoice): TaxSubtotal[] {
  const groups = new Map<
    VATCategory,
    {
      taxableAmount: number
      taxAmount: number
      taxPercent: number
      exemptionReasonCode?: string
      exemptionReason?: string
    }
  >()

  const add = (
    category: VATCategory,
    taxableAmount: number,
    taxAmount: number,
    taxPercent: number,
    exemptionReasonCode?: string
  ) => {
    const resolvedCode =
      exemptionReasonCode ||
      (category === 'O' ? 'VATEX-SA-OOS' : undefined)
    const current = groups.get(category) ?? {
      taxableAmount: 0,
      taxAmount: 0,
      taxPercent,
      exemptionReasonCode: resolvedCode,
      exemptionReason:
        category === 'Z'
          ? 'Zero-rated supply'
          : category === 'E'
            ? 'Exempt supply'
            : category === 'O'
              ? 'Out of scope of VAT'
              : undefined,
    }
    current.taxableAmount += taxableAmount
    current.taxAmount += taxAmount
    current.exemptionReasonCode =
      current.exemptionReasonCode ?? resolvedCode
    groups.set(category, current)
  }

  for (const item of invoice.items) {
    add(
      item.taxCategory,
      item.lineTotal,
      item.vatAmount,
      item.vatPercent,
      item.exemptionReasonCode
    )
  }

  // Shipping is not taxable in this store. It is still part of the payable
  // amount, so it is represented as an out-of-scope line.
  if (invoice.shippingPrice > 0) {
    add('O', invoice.shippingPrice, 0, 0)
  }

  return Array.from(groups.entries()).map(([taxCategory, value]) => ({
    taxableAmount: value.taxableAmount,
    taxAmount: value.taxAmount,
    taxCategory,
    taxPercent: value.taxPercent,
    exemptionReasonCode: value.exemptionReasonCode,
    exemptionReason: value.exemptionReason,
  }))
}

export function buildZatcaInvoice(
  invoice: IInvoice,
  submission: IZatcaSubmission,
  options: { sellerVatNumber?: string } = {}
): Invoice {
  if (!submission.icv || !submission.pih) {
    throw new Error('ZATCA submission is missing ICV/PIH')
  }

  const issuedAt =
    invoice.issuedAt instanceof Date
      ? invoice.issuedAt
      : new Date(invoice.issuedAt)
  if (Number.isNaN(issuedAt.getTime()))
    throw new Error('Invoice issue date is invalid')
  const { issueDate, issueTime } = dateParts(issuedAt)
  const isCreditNote = invoice.type === 'credit_note'
  // A partial refund can allocate zero to some lines. ZATCA rejects zero-amount
  // credit-note lines, so only the lines that actually move money are reported.
  const invoiceItems = isCreditNote
    ? invoice.items.filter(
        (item) => round2(item.lineTotal + item.vatAmount) !== 0
      )
    : invoice.items
  if (invoiceItems.length === 0) {
    throw new Error('Invoice has no billable lines')
  }
  const lines = invoiceItems.map((item, index) => ({
    id: String(index + 1),
    name: item.name,
    quantity: item.quantity,
    unitCode: 'PCE',
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    vatCategory: item.taxCategory,
    vatPercent: item.vatPercent,
    vatAmount: item.vatAmount,
  }))

  if (invoice.shippingPrice > 0) {
    lines.push({
      id: String(lines.length + 1),
      name: 'Shipping',
      quantity: 1,
      unitCode: 'PCE',
      unitPrice: invoice.shippingPrice,
      lineTotal: invoice.shippingPrice,
      vatCategory: 'O',
      vatPercent: 0,
      vatAmount: 0,
    })
  }

  const lineExtensionAmount = lines.reduce(
    (total, line) => total + line.lineTotal,
    0
  )
  const taxSubtotals = groupTaxSubtotals(invoice)
  const taxTotal = taxSubtotals.reduce(
    (total, subtotal) => total + subtotal.taxAmount,
    0
  )

  return {
    id: invoice.number,
    uuid: submission.uuid,
    issueDate,
    issueTime,
    invoiceTypeCode: isCreditNote ? '381' : '388',
    invoiceSubType: '0200000',
    documentCurrency: invoice.currency,
    taxCurrency: invoice.currency,
    billingReference: isCreditNote && invoice.originalInvoiceNumber
      ? { invoiceId: invoice.originalInvoiceNumber }
      : undefined,
    creditDebitReason: isCreditNote
      ? invoice.notes || 'Refund'
      : undefined,
    invoiceCounterValue: submission.icv,
    previousInvoiceHash: submission.pih,
    seller: {
      registrationName: invoice.seller.legalNameAr || invoice.seller.legalNameEn,
      vatNumber: options.sellerVatNumber || invoice.seller.vatNumber,
      identification: invoice.seller.crNumber
        ? { schemeId: 'CRN', value: invoice.seller.crNumber }
        : undefined,
      address: {
        street: invoice.seller.street || 'NA',
        buildingNumber: invoice.seller.buildingNumber || '0000',
        plotIdentification: invoice.seller.nationalAddress || undefined,
        citySubdivision: invoice.seller.citySubdivision || undefined,
        city: invoice.seller.city || 'Riyadh',
        postalCode: invoice.seller.postalCode || '00000',
        country: invoice.seller.country || 'SA',
      },
    },
    // B2C simplified invoices do not require buyer details.
    buyer: undefined,
    paymentMeansCode: '10',
    actualDeliveryDate: issueDate,
    lineExtensionAmount,
    taxExclusiveAmount: lineExtensionAmount,
    taxInclusiveAmount: lineExtensionAmount + taxTotal,
    allowanceTotalAmount: 0,
    prepaidAmount: 0,
    payableAmount: invoice.total,
    taxTotal,
    taxTotalInSAR: taxTotal,
    taxSubtotals,
    lines,
  }
}
