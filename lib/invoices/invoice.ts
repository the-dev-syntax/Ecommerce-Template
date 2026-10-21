import { ISettingInput } from '@/types'
import { connectToDatabase } from '@/lib/db'
import {
  InvoiceCounter,
  IInvoice,
  InvoiceType,
} from '@/lib/db/models/invoice.model'
import Invoice from '@/lib/db/models/invoice.model'
import Order, { OrderWithUser } from '@/lib/db/models/order.model'
import Setting from '@/lib/db/models/setting.model'
import { withSettingDefaults } from '@/lib/settings-defaults'
import { round2 } from '@/lib/utils'

import { allocateRefundToLines } from './credit-note'
import { buildZatcaQrPayload, getZatcaYear } from './qr'

async function getInvoiceSettings() {
  const raw = await Setting.findOne().lean()
  const setting = withSettingDefaults(
    raw ? (JSON.parse(JSON.stringify(raw)) as ISettingInput) : null
  )
  return { seller: setting.seller, invoice: setting.invoice }
}

async function allocateInvoiceNumber(prefix: string, sequenceLength: number) {
  const year = getZatcaYear(new Date())
  const key = `${prefix}-${year}`

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const counter = await InvoiceCounter.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      return `${prefix}-${year}-${String(counter.seq).padStart(sequenceLength, '0')}`
    } catch (error) {
      // Two concurrent first-invoices can race on the upsert; retry against
      // the now-existing counter document.
      if ((error as { code?: number }).code !== 11000) throw error
    }
  }

  throw new Error('Unable to allocate a unique invoice number')
}

function buyerAddress(order: OrderWithUser) {
  const address = order.shippingAddress
  return [
    address.street,
    address.city,
    address.province,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ')
}

/**
 * Create (or return) the immutable tax invoice / credit note for an order.
 * The unique orderId+type index and the atomic counter are the guards against
 * duplicate documents and duplicate numbers under concurrent webhooks.
 */
export async function createInvoiceForOrder(
  orderId: string,
  type: InvoiceType = 'invoice',
  options: { refundedAmount?: number; notes?: string } = {}
): Promise<IInvoice> {
  await connectToDatabase()

  const existing = await Invoice.findOne({
    orderId: String(orderId),
    type,
  }).lean()
  if (existing) return JSON.parse(JSON.stringify(existing)) as IInvoice

  const order = await Order.findById(orderId).populate<{
    user: { _id: string; email: string; name: string }
  }>('user', '_id name email')
  if (!order) throw new Error('Order not found')
  if (!order.isPaid) throw new Error('Invoice requires a paid order')

  const typedOrder = order as unknown as OrderWithUser
  const { seller, invoice: invoiceSettings } = await getInvoiceSettings()
  const issuedAt = new Date()
  // Orders created before tax snapshots were VAT-exclusive: their total is
  // items + shipping + VAT. New inclusive orders are items + shipping only.
  const looksExclusive =
    round2(
      typedOrder.totalPrice - typedOrder.itemsPrice - typedOrder.shippingPrice
    ) > 0.01
  const taxInclusive =
    typedOrder.taxInclusive === false || looksExclusive ? false : true
  const taxRate = typedOrder.taxRate ?? 0.15

  let items = typedOrder.items.map((item) => {
    const taxCategory = item.taxCategory ?? 'S'
    const vatPercent =
      item.vatPercent ??
      (taxCategory === 'S' ? round2(taxRate * 100) : 0)
    const unitPrice =
      item.netPrice ??
      (taxInclusive && taxCategory === 'S'
        ? round2(item.price / (1 + taxRate))
        : round2(item.price))
    const lineTotal = round2(unitPrice * item.quantity)
    const vatAmount =
      item.vatAmount ??
      (taxCategory === 'S'
        ? taxInclusive
          ? round2(item.price * item.quantity - lineTotal)
          : round2(lineTotal * taxRate)
        : 0)

    return {
      name: item.name,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      taxCategory,
      exemptionReasonCode: item.exemptionReasonCode ?? '',
      vatPercent,
      vatAmount,
    }
  })
  let itemsPrice = round2(
    items.reduce((acc, item) => acc + item.lineTotal, 0)
  )
  let shippingPrice = round2(typedOrder.shippingPrice)
  let vatAmount = round2(
    items.reduce((acc, item) => acc + item.vatAmount, 0)
  )
  let total = typedOrder.totalPrice
  let originalInvoiceNumber: string | undefined
  let refundedAmount: number | undefined

  if (type === 'credit_note') {
    const original = await createInvoiceForOrder(orderId, 'invoice')
    originalInvoiceNumber = original.number
    const refund = round2(
      options.refundedAmount ?? typedOrder.refundedAmount ?? 0
    )
    refundedAmount = refund

    if (refund <= 0)
      throw new Error('A credit note requires a refunded amount')

    const originalLines = [
      ...original.items.map((item) => ({
        name: item.name,
        lineTotal: item.lineTotal,
        vatAmount: item.vatAmount,
        taxCategory: item.taxCategory,
        exemptionReasonCode: item.exemptionReasonCode ?? '',
        vatPercent: item.vatPercent,
      })),
      ...(original.shippingPrice > 0
        ? [
            {
              name: 'Shipping',
              lineTotal: original.shippingPrice,
              vatAmount: 0,
              taxCategory: 'O' as const,
              exemptionReasonCode: '',
              vatPercent: 0,
            },
          ]
        : []),
    ]

    if (original.total <= 0) throw new Error('Original invoice has no total')

    const creditTotal = Math.min(refund, original.total)
    items = allocateRefundToLines(originalLines, creditTotal, original.total)
    if (items.length === 0) {
      throw new Error('Refund allocation produced no invoice lines')
    }

    vatAmount = round2(
      items.reduce((sum, item) => sum + item.vatAmount, 0)
    )
    itemsPrice = round2(
      items.reduce((sum, item) => sum + item.lineTotal, 0)
    )
    shippingPrice = 0
    total = creditTotal
  }

  // Legacy orders can have per-line VAT rounding that differs by a cent from
  // the stored tax total. Make the document add up exactly to the paid amount
  // so ZATCA's payableAmount check passes.
  const computedTotal = round2(itemsPrice + vatAmount + shippingPrice)
  const roundingDifference = round2(total - computedTotal)
  if (Math.abs(roundingDifference) >= 0.01) {
    const lastTaxableLine = [...items]
      .reverse()
      .find(
        (item) =>
          item.taxCategory === 'S' &&
          item.vatAmount + roundingDifference >= 0
      )
    if (lastTaxableLine) {
      lastTaxableLine.vatAmount = round2(
        lastTaxableLine.vatAmount + roundingDifference
      )
      vatAmount = round2(vatAmount + roundingDifference)
    }
  }

  const sellerName = seller.legalNameAr || seller.legalNameEn
  const qrPayload = buildZatcaQrPayload({
    sellerName,
    vatNumber: seller.vatNumber,
    issuedAt,
    total,
    vatAmount,
  })

  for (let attempt = 0; attempt < 3; attempt++) {
    const number = await allocateInvoiceNumber(
      invoiceSettings.prefix,
      invoiceSettings.sequenceLength
    )

    try {
      const created = await Invoice.create({
        number,
        type,
        orderId: String(typedOrder._id),
        issuedAt,
        currency: typedOrder.currency || 'SAR',
        seller,
        buyer: {
          name: typedOrder.shippingAddress.fullName,
          email: typedOrder.user?.email ?? '',
          phone: typedOrder.shippingAddress.phone,
          address: buyerAddress(typedOrder),
        },
        items,
        itemsPrice,
        shippingPrice,
        vatAmount,
        total,
        refundedAmount,
        originalInvoiceNumber,
        qrPayload,
        notes: options.notes,
      })
      return created.toObject() as IInvoice
    } catch (error) {
      const mongoError = error as { code?: number }
      if (mongoError.code !== 11000) throw error

      const duplicate = await Invoice.findOne({
        orderId: String(orderId),
        type,
      }).lean()
      if (duplicate) return JSON.parse(JSON.stringify(duplicate)) as IInvoice

      // A number collision (for example after a manual counter reset) is
      // retried with the next sequence value.
    }
  }

  throw new Error('Unable to allocate a unique invoice number')
}

export async function getInvoiceForOrder(
  orderId: string,
  type: InvoiceType = 'invoice'
): Promise<IInvoice | null> {
  await connectToDatabase()
  const invoice = await Invoice.findOne({ orderId: String(orderId), type }).lean()
  return invoice ? (JSON.parse(JSON.stringify(invoice)) as IInvoice) : null
}

export async function getOrCreateInvoiceForOrder(
  orderId: string,
  type: InvoiceType = 'invoice'
): Promise<IInvoice> {
  const existing = await getInvoiceForOrder(orderId, type)
  if (existing) return existing
  return createInvoiceForOrder(orderId, type)
}

export async function getOrCreateCreditNoteForOrder(
  orderId: string
): Promise<IInvoice | null> {
  await connectToDatabase()
  const order = await Order.findById(orderId).lean()
  if (!order || !order.isPaid) return null

  const refunded = order.refundedAmount ?? 0
  if (refunded <= 0) return null

  const existing = await getInvoiceForOrder(orderId, 'credit_note')
  if (existing) return existing

  return createInvoiceForOrder(orderId, 'credit_note', {
    refundedAmount: refunded,
    notes: order.cancelReason,
  })
}
