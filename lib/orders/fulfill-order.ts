import mongoose from 'mongoose'

import { sendPurchaseReceipt } from '@/emails'
import { connectToDatabase } from '@/lib/db'
import Order, { OrderWithUser } from '@/lib/db/models/order.model'
import Product from '@/lib/db/models/product.model'
import StockReservation from '@/lib/db/models/stock-reservation.model'
import { createInvoiceForOrder } from '@/lib/invoices/invoice'
import { recordInventoryAdjustment } from '@/lib/inventory/adjustments'
import {
  recoverCapturedPayment,
  RecoveryRetryError,
  type RecoveryResult,
} from '@/lib/orders/payment-recovery'
import { queueZatcaForInvoice } from '@/lib/zatca/service'

class FulfillmentStockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FulfillmentStockError'
  }
}

class FulfillmentClosedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FulfillmentClosedError'
  }
}

export type FulfillOrderInput = {
  orderId: string
  provider: string
  paymentId: string
  amountPaid: number
  currency: string
  email?: string
  status?: string
  actorId?: string
  actorEmail?: string
}

async function sendReceiptOnce(orderId: string) {
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, receiptSentAt: null },
    { $set: { receiptSentAt: new Date() } },
    { new: true }
  )
  if (!claimed) return

  try {
    const order = await Order.findById(orderId).populate<{
      user: { _id: string; email: string; name: string }
    }>('user', '_id name email')

    if (!order?.user?.email) throw new Error('Order has no customer email')

    await sendPurchaseReceipt({ order: order as unknown as OrderWithUser })
  } catch (error) {
    await Order.findByIdAndUpdate(orderId, { $unset: { receiptSentAt: 1 } })
    console.error(
      'Purchase receipt email failed (order remains paid):',
      error instanceof Error ? error.name : 'Unknown error'
    )
  }
}

/**
 * The single fulfillment path for every payment provider.
 * Marks the order paid, decrements stock and increments sales exactly once.
 */
export async function fulfillOrder({
  orderId,
  provider,
  paymentId,
  amountPaid,
  currency,
  email = '',
  status = 'COMPLETED',
  actorId,
  actorEmail,
}: FulfillOrderInput): Promise<{
  success: true
  alreadyPaid: boolean
  recovery?: RecoveryResult
}> {
  await connectToDatabase()

  const session = await mongoose.connection.startSession()
  let alreadyPaid = false
  let recovery: RecoveryResult | undefined
  const stockAudit = new Map<
    string,
    {
      product: string
      productName: string
      variantId?: string
      sku?: string
      variantLabel?: string
      previousStock: number
      newStock: number
      quantityChange: number
    }
  >()

  try {
    await session.withTransaction(async () => {
      stockAudit.clear()
      const order = await Order.findById(orderId).session(session)
      if (!order) throw new Error('Order not found')

      if (order.isPaid) {
        alreadyPaid = true
        return
      }

      if (order.isCancelled)
        throw new FulfillmentClosedError('Order is cancelled')

      if (order.paymentMethod !== provider)
        throw new Error('Payment method does not match this order')

      const orderCurrency = (order.currency || 'USD').toUpperCase()
      if (orderCurrency !== currency.toUpperCase())
        throw new Error('Payment currency does not match this order')

      if (Math.round(amountPaid * 100) !== Math.round(order.totalPrice * 100))
        throw new Error('Paid amount does not match this order total')

      const reservation = await StockReservation.findOne({
        orderId: String(order._id),
      }).session(session)
      const holdsStock =
        reservation != null &&
        (reservation.status === 'held' || reservation.status === 'committed')

      for (const item of order.items) {
        if (holdsStock) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { numSales: item.quantity } },
            { session }
          )
          continue
        }

        const product = item.variantId
          ? await Product.findOneAndUpdate(
              {
                _id: item.product,
                countInStock: { $gte: item.quantity },
                variants: {
                  $elemMatch: {
                    id: item.variantId,
                    countInStock: { $gte: item.quantity },
                  },
                },
              },
              {
                $inc: {
                  countInStock: -item.quantity,
                  numSales: item.quantity,
                  'variants.$.countInStock': -item.quantity,
                },
              },
              { new: true, session }
            )
          : await Product.findOneAndUpdate(
              {
                _id: item.product,
                countInStock: { $gte: item.quantity },
              },
              {
                $inc: {
                  countInStock: -item.quantity,
                  numSales: item.quantity,
                },
              },
              { new: true, session }
            )

        if (!product)
          throw new FulfillmentStockError(
            `Not enough stock for ${item.name}`
          )

        const variant = item.variantId
          ? product.variants?.find((entry) => entry.id === item.variantId)
          : undefined
        const newStock = variant ? variant.countInStock : product.countInStock
        stockAudit.set(
          `${String(product._id)}:${item.variantId ?? ''}:${item.clientId}`,
          {
          product: String(product._id),
          productName: product.name,
          variantId: variant?.id,
          sku: variant?.sku,
          variantLabel: variant
            ? [variant.size, variant.color].filter(Boolean).join(' / ')
            : '',
          previousStock: newStock + item.quantity,
          newStock,
          quantityChange: -item.quantity,
        })
      }

      if (holdsStock) {
        reservation.status = 'committed'
        await reservation.save({ session })
      }

      order.isPaid = true
      order.paidAt = new Date()
      order.status = 'paid'
      order.statusHistory = [
        ...(order.statusHistory ?? []),
        {
          status: 'paid',
          at: new Date(),
          note: `Paid via ${provider}`,
          actorId,
          actorEmail,
        },
      ]
      order.paymentResult = {
        id: paymentId,
        status,
        email_address: email,
        pricePaid: amountPaid.toFixed(2),
      }

      await order.save({ session })
    })
  } catch (error) {
    if (
      error instanceof FulfillmentStockError ||
      error instanceof FulfillmentClosedError
    ) {
      // The gateway captured the money, but the transaction rolled back and
      // the order is not fulfilled. Never discard that payment: start the
      // idempotent refund/review recovery path instead of returning a webhook
      // error that would retry forever.
      recovery = await recoverCapturedPayment({
        orderId,
        provider,
        paymentId,
        amountPaid,
        currency,
        email,
        reason: error.message,
      })

      if (recovery.outcome === 'retry') {
        throw new RecoveryRetryError(recovery.message)
      }

      return { success: true, alreadyPaid: false, recovery }
    }
    throw error
  } finally {
    await session.endSession()
  }

  for (const entry of stockAudit.values()) {
    await recordInventoryAdjustment({
      ...entry,
      source: 'order_fulfilled',
      reason: 'Payment fulfilled without an active reservation',
      orderId,
    })
  }

  try {
    const invoice = await createInvoiceForOrder(orderId)
    await queueZatcaForInvoice(String(invoice._id))
  } catch (error) {
    console.error(
      'Invoice/ZATCA creation failed (order remains paid; the invoice page retries):',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  await sendReceiptOnce(orderId)

  return { success: true, alreadyPaid }
}
