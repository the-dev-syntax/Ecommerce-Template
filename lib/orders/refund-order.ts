import mongoose from 'mongoose'

import { connectToDatabase } from '@/lib/db'
import Order, { IOrder } from '@/lib/db/models/order.model'
import Product from '@/lib/db/models/product.model'
import { createInvoiceForOrder } from '@/lib/invoices/invoice'
import {
  fetchMoyasarPayment,
  isMoyasarRefundable,
  refundMoyasarPayment,
  voidMoyasarPayment,
} from '@/lib/payments/moyasar'
import { round2 } from '@/lib/utils'

function getMoyasarPaymentId(order: IOrder): string {
  const paymentId = order.moyasarPaymentId ?? order.paymentResult?.id
  if (!paymentId) throw new Error('Payment reference is missing')
  return paymentId
}

function assertMoyasarOrder(order: IOrder) {
  if (order.paymentMethod !== 'Moyasar')
    throw new Error(
      'Automatic refunds are only supported for Moyasar orders. Refund this order manually.'
    )
}

/**
 * Refund a paid Moyasar order, fully or partially. The refundable amount is
 * read from Moyasar before every call so a partial refund can never overdraw.
 */
export async function refundMoyasarOrderPayment(
  orderId: string,
  amount?: number
) {
  await connectToDatabase()

  const order = await Order.findById(orderId)
  if (!order) throw new Error('Order not found')
  if (!order.isPaid) throw new Error('Order is not paid')
  if (order.isCancelled) throw new Error('Cancelled orders cannot be refunded')
  assertMoyasarOrder(order)

  if (amount !== undefined) {
    if (typeof amount !== 'number' || !Number.isFinite(amount))
      throw new Error('Invalid refund amount')
  }

  const paymentId = getMoyasarPaymentId(order)
  const payment = await fetchMoyasarPayment(paymentId)

  if (!isMoyasarRefundable(payment.status))
    throw new Error(`Payment cannot be refunded (status: ${payment.status})`)

  const remainingHalalas = payment.amount - (payment.refunded ?? 0)
  if (remainingHalalas <= 0) throw new Error('Payment is already fully refunded')

  const requestedHalalas =
    amount === undefined ? remainingHalalas : Math.round(round2(amount) * 100)

  if (requestedHalalas < 1)
    throw new Error('Refund amount must be at least 0.01')
  if (requestedHalalas > remainingHalalas)
    throw new Error('Refund amount exceeds the refundable amount')

  const updatedPayment =
    requestedHalalas === remainingHalalas
      ? await refundMoyasarPayment(paymentId)
      : await refundMoyasarPayment(paymentId, requestedHalalas)

  const refundedAmount =
    (updatedPayment.refunded ?? (payment.refunded ?? 0) + requestedHalalas) / 100
  const fullyRefunded = refundedAmount >= payment.amount / 100
  const now = new Date()

  order.refundedAmount = refundedAmount
  order.refundedAt = now
  order.refundHistory = order.refundHistory ?? []
  order.refundHistory.push({
    amount: requestedHalalas / 100,
    provider: 'Moyasar',
    refundedAt: now,
  })
  order.paymentResult = {
    id: order.paymentResult?.id ?? payment.id,
    status: fullyRefunded
      ? 'refunded'
      : order.paymentResult?.status ?? payment.status,
    email_address: order.paymentResult?.email_address ?? '',
    pricePaid: order.paymentResult?.pricePaid ?? order.totalPrice.toFixed(2),
  }

  await order.save()

  try {
    await createInvoiceForOrder(orderId, 'credit_note', { refundedAmount })
  } catch (error) {
    console.error(
      'Credit note creation failed (the invoice page retries):',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  return { order, refundedAmount, fullyRefunded }
}

/**
 * Cancel an unpaid order, or cancel + refund a paid Moyasar order. Paid orders
 * are only cancelled after the gateway confirms the refund, and stock/sales are
 * restored exactly once inside a transaction.
 */
export async function cancelOrderById(orderId: string, reason?: string) {
  await connectToDatabase()

  if (reason && reason.trim().length > 500)
    throw new Error('Cancellation reason is too long')

  const order = await Order.findById(orderId)
  if (!order) throw new Error('Order not found')
  if (order.isCancelled)
    return {
      order,
      alreadyCancelled: true,
      refundedAmount: order.refundedAmount ?? 0,
    }
  if (order.isDelivered)
    throw new Error('Delivered orders cannot be cancelled')

  const wasPaid = order.isPaid
  let refundedAmount = order.refundedAmount ?? 0
  let refundedAt: Date | undefined

  if (wasPaid && order.paymentMethod === 'Cash On Delivery') {
    // Cash is returned outside the system; still cancel and restock.
    refundedAmount = order.refundedAmount ?? 0
  } else if (wasPaid) {
    assertMoyasarOrder(order)

    const paymentId = getMoyasarPaymentId(order)
    let payment = await fetchMoyasarPayment(paymentId)

    if (payment.status === 'authorized') {
      payment = await voidMoyasarPayment(paymentId)
    } else if (isMoyasarRefundable(payment.status)) {
      const remainingHalalas = payment.amount - (payment.refunded ?? 0)
      if (remainingHalalas > 0) {
        payment = await refundMoyasarPayment(paymentId)
      }
    } else if (payment.status === 'refunded') {
      const remainingHalalas = payment.amount - (payment.refunded ?? 0)
      if (remainingHalalas > 0)
        throw new Error(
          'This payment was partially refunded. Moyasar allows only one refund per payment, so the remaining amount cannot be refunded automatically.'
        )
    } else {
      throw new Error(`Payment cannot be cancelled (status: ${payment.status})`)
    }

    refundedAmount = (payment.refunded ?? 0) / 100
    refundedAt = new Date()
  }

  const session = await mongoose.connection.startSession()
  let alreadyCancelled = false

  try {
    await session.withTransaction(async () => {
      const fresh = await Order.findById(orderId).session(session)
      if (!fresh) throw new Error('Order not found')

      if (fresh.isCancelled) {
        alreadyCancelled = true
        return
      }
      if (fresh.isDelivered)
        throw new Error('Delivered orders cannot be cancelled')

      if (wasPaid) {
        for (const item of fresh.items) {
          await Product.updateOne(
            { _id: item.product },
            {
              $inc: {
                countInStock: item.quantity,
                numSales: -item.quantity,
              },
            },
            { session }
          )
        }
        const previouslyRefunded = fresh.refundedAmount ?? 0
        if (refundedAmount > previouslyRefunded) {
          fresh.refundHistory = fresh.refundHistory ?? []
          fresh.refundHistory.push({
            amount: refundedAmount - previouslyRefunded,
            provider: 'Moyasar',
            refundedAt: refundedAt ?? new Date(),
          })
        }
        fresh.refundedAmount = refundedAmount
        if (refundedAt) fresh.refundedAt = refundedAt
      }

      fresh.isCancelled = true
      fresh.cancelledAt = new Date()
      fresh.cancelReason = reason?.trim() || undefined

      await fresh.save({ session })
    })
  } finally {
    await session.endSession()
  }

  if (refundedAmount > 0) {
    try {
      await createInvoiceForOrder(orderId, 'credit_note', { refundedAmount })
    } catch (error) {
      console.error(
        'Credit note creation failed (the invoice page retries):',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  const cancelledOrder = await Order.findById(orderId)
  return {
    order: cancelledOrder ?? order,
    alreadyCancelled,
    refundedAmount,
  }
}
