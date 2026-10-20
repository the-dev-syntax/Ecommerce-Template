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

  let items = typedOrder.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    lineTotal: round2(item.price * item.quantity),
  }))
  let itemsPrice = typedOrder.itemsPrice
  let shippingPrice = typedOrder.shippingPrice
  let vatAmount = typedOrder.taxPrice
  let total = typedOrder.totalPrice
  let originalInvoiceNumber: string | undefined
  let refundedAmount: number | undefined

  if (type === 'credit_note') {
    const original = await createInvoiceForOrder(orderId, 'invoice')
    originalInvoiceNumber = original.number
    refundedAmount = round2(options.refundedAmount ?? typedOrder.refundedAmount ?? 0)

    if (refundedAmount <= 0)
      throw new Error('A credit note requires a refunded amount')

    const ratio = original.total > 0 ? refundedAmount / original.total : 0
    vatAmount = round2(original.vatAmount * ratio)
    itemsPrice = round2(refundedAmount - vatAmount)
    shippingPrice = 0
    total = refundedAmount
    items = [
      {
        name: 'Refund',
        quantity: 1,
        unitPrice: itemsPrice,
        lineTotal: itemsPrice,
      },
    ]
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
