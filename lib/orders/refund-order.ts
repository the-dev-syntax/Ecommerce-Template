import mongoose from 'mongoose'

import { connectToDatabase } from '@/lib/db'
import Order, { IOrder } from '@/lib/db/models/order.model'
import OrderReturn, {
  type RefundProvider,
} from '@/lib/db/models/order-return.model'
import Product from '@/lib/db/models/product.model'
import { createInvoiceForOrder } from '@/lib/invoices/invoice'
import {
  markStockReservationReleased,
  releaseStockReservation,
} from '@/lib/orders/stock-reservations'
import {
  calculateCancellationLines,
  calculateReturnLines,
  getShippingRefundAmount,
  toCreditNoteLines,
  type ReturnSelection,
} from '@/lib/returns/calculations'
import type { RefundReason } from '@/lib/returns/policy'
import { queueZatcaForInvoice } from '@/lib/zatca/service'
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
      'Automatic refunds are only supported for Moyasar orders. Record a manual refund instead.'
    )
}

export interface ProcessOrderReturnInput {
  orderId: string
  selections: ReturnSelection[]
  reason: RefundReason
  policyOverrideReason?: string
  manualReference?: string
  idempotencyKey: string
  forceManual?: boolean
  createdBy?: string
}

export interface ProcessOrderReturnResult {
  order: IOrder
  returnId: string
  refundAmount: number
  refundedAmount: number
  provider: RefundProvider
  fullyRefunded: boolean
}

/**
 * Item-level return/refund.
 *
 * - Only delivered, paid orders are eligible (pre-delivery orders are cancelled).
 * - Prices and VAT come from the order snapshots, never from the browser.
 * - Shipping is excluded for change-of-mind returns and included for
 *   defective/wrong-item returns.
 * - A final-sale item requires a defective/wrong-item override reason.
 * - Only return_and_refund quantities are restocked.
 * - Moyasar allows one refund call per payment. The first refund is automatic;
 *   later refunds on the same payment are recorded manually.
 */
export async function processOrderReturn(
  input: ProcessOrderReturnInput
): Promise<ProcessOrderReturnResult> {
  await connectToDatabase()

  const order = await Order.findById(input.orderId)
  if (!order) throw new Error('Order not found')
  if (!order.isPaid) throw new Error('Order is not paid')
  if (order.isCancelled) throw new Error('Cancelled orders cannot be refunded')
  if (!order.isDelivered) {
    throw new Error(
      'Returns can only be processed after delivery. Cancel the order instead.'
    )
  }
  if (!input.idempotencyKey?.trim()) {
    throw new Error('A refund request key is required')
  }

  const existingReturn = await OrderReturn.findOne({
    orderId: String(order._id),
    idempotencyKey: input.idempotencyKey,
  }).lean()
  if (existingReturn) {
    throw new Error('This refund request was already processed')
  }

  const taxInclusive = order.taxInclusive ?? true
  const taxRate = order.taxRate ?? 0.15
  const calculationOptions = { taxInclusive, taxRate }
  const lines = calculateReturnLines(
    order.items,
    input.selections,
    input.reason,
    calculationOptions
  )

  const overrideReason = input.policyOverrideReason?.trim()
  const needsOverride = lines.some(
    (line) => line.returnPolicy === 'final_sale'
  )
  if (needsOverride && !overrideReason) {
    throw new Error(
      'A reason is required when refunding a final-sale item'
    )
  }
  if (overrideReason && overrideReason.length > 500) {
    throw new Error('Override reason is too long')
  }

  const shippingAmount = getShippingRefundAmount(
    round2(order.shippingPrice + (order.codFee ?? 0)),
    input.reason,
    order.shippingRefunded ?? false
  )
  const itemsRefund = round2(
    lines.reduce((sum, line) => sum + line.grossAmount, 0)
  )
  const refundAmount = round2(itemsRefund + shippingAmount)
  if (refundAmount <= 0) throw new Error('Refund amount must be at least 0.01')

  const previousRefunded = round2(order.refundedAmount ?? 0)
  const isMoyasar = order.paymentMethod === 'Moyasar'
  const canAutoRefund =
    isMoyasar && previousRefunded <= 0 && !input.forceManual
  const provider: RefundProvider = canAutoRefund ? 'Moyasar' : 'Manual'

  let refundedAmount = previousRefunded
  let refundReference = input.manualReference?.trim()
  let fullyRefunded = false
  let paymentStatus: string | undefined

  if (provider === 'Moyasar') {
    assertMoyasarOrder(order)
    const paymentId = getMoyasarPaymentId(order)
    const payment = await fetchMoyasarPayment(paymentId)
    if (!isMoyasarRefundable(payment.status)) {
      throw new Error(`Payment cannot be refunded (status: ${payment.status})`)
    }

    const remainingHalalas = payment.amount - (payment.refunded ?? 0)
    const requestedHalalas = Math.round(refundAmount * 100)
    if (requestedHalalas < 1) {
      throw new Error('Refund amount must be at least 0.01')
    }
    if (requestedHalalas > remainingHalalas) {
      throw new Error('Refund amount exceeds the remaining payment')
    }

    const updatedPayment =
      requestedHalalas === remainingHalalas
        ? await refundMoyasarPayment(paymentId)
        : await refundMoyasarPayment(paymentId, requestedHalalas)

    refundReference = updatedPayment.id
    refundedAmount = round2(
      (updatedPayment.refunded ??
        (payment.refunded ?? 0) + requestedHalalas) / 100
    )
    paymentStatus =
      refundedAmount >= payment.amount / 100 ? 'refunded' : payment.status
  } else {
    refundedAmount = round2(previousRefunded + refundAmount)
    refundReference = refundReference || 'manual'
  }

  if (refundedAmount > round2(order.totalPrice) + 0.01) {
    throw new Error('Refund exceeds the order total')
  }
  fullyRefunded = refundedAmount >= round2(order.totalPrice) - 0.01

  const refundedAt = new Date()
  const session = await mongoose.connection.startSession()
  let returnId = ''

  try {
    await session.withTransaction(async () => {
      const fresh = await Order.findById(input.orderId).session(session)
      if (!fresh) throw new Error('Order not found')
      if (!fresh.isPaid) throw new Error('Order is not paid')
      if (fresh.isCancelled) throw new Error('Order is cancelled')

      // Revalidate against concurrent returns before writing counters.
      const freshLines = calculateReturnLines(
        fresh.items,
        input.selections,
        input.reason,
        calculationOptions
      )
      const freshShipping = getShippingRefundAmount(
        round2(fresh.shippingPrice + (fresh.codFee ?? 0)),
        input.reason,
        fresh.shippingRefunded ?? false
      )
      const freshRefund = round2(
        freshLines.reduce((sum, line) => sum + line.grossAmount, 0) +
          freshShipping
      )
      if (Math.abs(freshRefund - refundAmount) >= 0.01) {
        throw new Error('The order changed while the refund was processed')
      }

      const [createdReturn] = await OrderReturn.create(
        [
          {
            orderId: String(fresh._id),
            kind: 'return',
            idempotencyKey: input.idempotencyKey,
            items: freshLines.map((line) => ({
              clientId: line.clientId,
              product: line.product,
              name: line.name,
              quantity: line.quantity,
              returnPolicy: line.returnPolicy,
              variantId: line.variantId ?? '',
              sku: line.sku ?? '',
              variantLabel: line.variantLabel ?? '',
              netAmount: line.netAmount,
              vatAmount: line.vatAmount,
              grossAmount: line.grossAmount,
              restocked: line.returnPolicy === 'return_and_refund',
            })),
            reason: input.reason,
            policyOverrideReason: overrideReason ?? '',
            shippingRefunded: freshShipping > 0,
            shippingAmount: freshShipping,
            refundAmount,
            refundProvider: provider,
            refundReference: refundReference ?? '',
            refundedAt,
            createdBy: input.createdBy ?? '',
            notes: overrideReason,
          },
        ],
        { session }
      )
      returnId = String(createdReturn._id)

      for (const line of freshLines) {
        const restock = line.returnPolicy === 'return_and_refund'
        await Order.updateOne(
          { _id: fresh._id, 'items.clientId': line.clientId },
          {
            $inc: {
              'items.$.refundedQuantity': line.quantity,
              ...(restock
                ? { 'items.$.restockedQuantity': line.quantity }
                : {}),
            },
          },
          { session }
        )

        if (restock) {
          const increment = {
            countInStock: line.quantity,
            numSales: -line.quantity,
            ...(line.variantId
              ? { 'variants.$.countInStock': line.quantity }
              : {}),
          }
          await Product.updateOne(
            line.variantId
              ? { _id: line.product, 'variants.id': line.variantId }
              : { _id: line.product },
            { $inc: increment },
            { session }
          )
        }
      }

      const paymentUpdate =
        provider === 'Moyasar'
          ? {
              paymentResult: {
                id: order.paymentResult?.id,
                status: paymentStatus ?? order.paymentResult?.status,
                email_address: order.paymentResult?.email_address ?? '',
                pricePaid:
                  order.paymentResult?.pricePaid ??
                  order.totalPrice.toFixed(2),
              },
            }
          : {}

      const allItemsRefunded = fresh.items.every((item) => {
        if (item.quantity <= 0) return true
        const selected =
          freshLines.find((line) => line.clientId === item.clientId)
            ?.quantity ?? 0
        return (item.refundedQuantity ?? 0) + selected >= item.quantity
      })
      const nextStatus = fullyRefunded
        ? 'refunded'
        : allItemsRefunded
          ? 'returned'
          : fresh.status

      await Order.updateOne(
        { _id: fresh._id },
        {
          $set: {
            refundedAmount,
            refundedAt,
            ...(nextStatus ? { status: nextStatus } : {}),
            ...(freshShipping > 0 ? { shippingRefunded: true } : {}),
            ...paymentUpdate,
          },
          $push: {
            refundHistory: {
              amount: refundAmount,
              provider,
              refundedAt,
              reason: input.reason,
              returnId,
              reference: refundReference ?? '',
            },
            statusHistory: {
              status: nextStatus ?? 'paid',
              at: refundedAt,
              note: allItemsRefunded
                ? 'All items returned'
                : 'Return processed',
            },
          },
        },
        { session }
      )
    })
  } finally {
    await session.endSession()
  }

  try {
    const creditNote = await createInvoiceForOrder(input.orderId, 'credit_note', {
      eventId: returnId,
      reason: 'return',
      lines: toCreditNoteLines(lines),
      shippingPrice: shippingAmount,
      refundedAmount: refundAmount,
      notes: overrideReason,
    })
    await queueZatcaForInvoice(String(creditNote._id))
  } catch (error) {
    console.error(
      'Credit note creation failed (the invoice page retries):',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  const updatedOrder = (await Order.findById(input.orderId)) ?? order
  return {
    order: updatedOrder,
    returnId,
    refundAmount,
    refundedAmount,
    provider,
    fullyRefunded,
  }
}

/**
 * Cancel an unpaid order, or cancel + refund a paid order. Paid orders are
 * only cancelled after the gateway confirms the refund (or the admin records a
 * manual refund), and stock/sales are restored exactly once in a transaction.
 *
 * Cancellation is a seller-side path: every item and the shipping are refunded
 * regardless of the product return policy.
 */
export async function cancelOrderById(
  orderId: string,
  reason?: string,
  options: { manualReference?: string; createdBy?: string } = {}
) {
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
  const previousRefunded = round2(order.refundedAmount ?? 0)
  const remaining = round2(order.totalPrice - previousRefunded)
  let refundedAmount = previousRefunded
  let refundedAt: Date | undefined
  let provider: RefundProvider = 'Manual'
  let paymentStatus: string | undefined

  if (wasPaid && remaining > 0) {
    if (order.paymentMethod === 'Moyasar' && previousRefunded <= 0) {
      assertMoyasarOrder(order)
      const paymentId = getMoyasarPaymentId(order)
      let payment = await fetchMoyasarPayment(paymentId)

      if (payment.status === 'authorized') {
        payment = await voidMoyasarPayment(paymentId)
        refundedAmount = previousRefunded
      } else if (isMoyasarRefundable(payment.status)) {
        const remainingHalalas = payment.amount - (payment.refunded ?? 0)
        if (remainingHalalas > 0) {
          payment = await refundMoyasarPayment(paymentId)
        }
        refundedAmount = round2((payment.refunded ?? 0) / 100)
        refundedAt = new Date()
        provider = 'Moyasar'
        paymentStatus =
          refundedAmount >= payment.amount / 100 ? 'refunded' : payment.status
      } else if (payment.status === 'refunded') {
        const remainingHalalas = payment.amount - (payment.refunded ?? 0)
        if (remainingHalalas > 0)
          throw new Error(
            'This payment was partially refunded. Record the remaining cancellation refund manually.'
          )
      } else {
        throw new Error(`Payment cannot be cancelled (status: ${payment.status})`)
      }
    } else {
      // COD, Stripe, PayPal, or a second refund on a Moyasar payment: record the
      // refund as manual. The money is returned outside the gateway.
      refundedAmount = round2(order.totalPrice)
      refundedAt = new Date()
      provider = 'Manual'
    }
  }

  const now = refundedAt ?? new Date()
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
          const increment = {
            countInStock: item.quantity,
            numSales: -item.quantity,
            ...(item.variantId
              ? { 'variants.$.countInStock': item.quantity }
              : {}),
          }
          await Product.updateOne(
            item.variantId
              ? { _id: item.product, 'variants.id': item.variantId }
              : { _id: item.product },
            { $inc: increment },
            { session }
          )
        }
        const previouslyRefunded = fresh.refundedAmount ?? 0
        if (refundedAmount > previouslyRefunded) {
          await Order.updateOne(
            { _id: fresh._id },
            {
              $set: {
                refundedAmount,
                refundedAt: now,
                shippingRefunded: true,
                ...(provider === 'Moyasar'
                  ? {
                      paymentResult: {
                        id:
                          fresh.paymentResult?.id ??
                          fresh.moyasarPaymentId,
                        status:
                          paymentStatus ??
                          fresh.paymentResult?.status,
                        email_address:
                          fresh.paymentResult?.email_address ?? '',
                        pricePaid:
                          fresh.paymentResult?.pricePaid ??
                          fresh.totalPrice.toFixed(2),
                      },
                    }
                  : {}),
              },
              $push: {
                refundHistory: {
                  amount: refundedAmount - previouslyRefunded,
                  provider,
                  refundedAt: now,
                  reason: 'cancellation',
                  reference: options.manualReference?.trim() || 'manual',
                },
              },
            },
            { session }
          )
        }
      }

      await Order.updateOne(
        { _id: fresh._id },
        {
          $set: {
            isCancelled: true,
            cancelledAt: new Date(),
            cancelReason: reason?.trim() || undefined,
            status: 'cancelled',
          },
          $push: {
            statusHistory: {
              status: 'cancelled',
              at: new Date(),
              note: reason?.trim() || 'Cancelled',
            },
          },
        },
        { session }
      )
    })
  } finally {
    await session.endSession()
  }

  if (!alreadyCancelled) {
    if (wasPaid) {
      await markStockReservationReleased(orderId)
    } else {
      await releaseStockReservation(orderId, true)
    }
  }

  if (refundedAmount > 0) {
    try {
      const cancellationOrder = await Order.findById(orderId).lean()
      if (cancellationOrder) {
        const lines = calculateCancellationLines(cancellationOrder.items, {
          taxInclusive: cancellationOrder.taxInclusive ?? true,
          taxRate: cancellationOrder.taxRate ?? 0.15,
        })
        const shippingStillRefundable =
          !(order.shippingRefunded ?? false) &&
          order.shippingPrice + (order.codFee ?? 0) > 0
        const shippingAmount = shippingStillRefundable
          ? round2(order.shippingPrice + (order.codFee ?? 0))
          : 0

        const creditNote = await createInvoiceForOrder(
          orderId,
          'credit_note',
          {
            eventId: `cancel:${String(orderId)}`,
            reason: 'cancellation',
            lines: toCreditNoteLines(lines),
            shippingPrice: shippingAmount,
            refundedAmount: round2(
              lines.reduce((sum, line) => sum + line.grossAmount, 0) +
                shippingAmount
            ),
            notes: reason?.trim() || undefined,
          }
        )
        await queueZatcaForInvoice(String(creditNote._id))
      }
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
