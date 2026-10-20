import mongoose from 'mongoose'

import { sendPurchaseReceipt } from '@/emails'
import { connectToDatabase } from '@/lib/db'
import Order, { OrderWithUser } from '@/lib/db/models/order.model'
import Product from '@/lib/db/models/product.model'

export type FulfillOrderInput = {
  orderId: string
  provider: string
  paymentId: string
  amountPaid: number
  currency: string
  email?: string
  status?: string
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
}: FulfillOrderInput) {
  await connectToDatabase()

  const session = await mongoose.connection.startSession()
  let alreadyPaid = false

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session)
      if (!order) throw new Error('Order not found')

      if (order.isPaid) {
        alreadyPaid = true
        return
      }

      if (order.isCancelled) throw new Error('Order is cancelled')

      if (order.paymentMethod !== provider)
        throw new Error('Payment method does not match this order')

      const orderCurrency = (order.currency || 'USD').toUpperCase()
      if (orderCurrency !== currency.toUpperCase())
        throw new Error('Payment currency does not match this order')

      if (Math.round(amountPaid * 100) !== Math.round(order.totalPrice * 100))
        throw new Error('Paid amount does not match this order total')

      for (const item of order.items) {
        const product = await Product.findOneAndUpdate(
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

        if (!product) throw new Error(`Not enough stock for ${item.name}`)
      }

      order.isPaid = true
      order.paidAt = new Date()
      order.paymentResult = {
        id: paymentId,
        status,
        email_address: email,
        pricePaid: amountPaid.toFixed(2),
      }

      await order.save({ session })
    })
  } finally {
    await session.endSession()
  }

  await sendReceiptOnce(orderId)

  return { success: true, alreadyPaid }
}
