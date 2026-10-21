import mongoose from 'mongoose'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import { connectToDatabase } from '@/lib/db'
import Order from '@/lib/db/models/order.model'
import { getMoyasarWebhookSecret } from '@/lib/env'
import { createInvoiceForOrder } from '@/lib/invoices/invoice'
import { fulfillOrder } from '@/lib/orders/fulfill-order'
import { queueZatcaForInvoice } from '@/lib/zatca/service'
import {
  attachPaymentEventOrder,
  beginPaymentEvent,
  finishPaymentEvent,
} from '@/lib/payments/events'
import {
  fetchMoyasarPayment,
  isMoyasarPaid,
  toMoyasarAmount,
  verifyMoyasarWebhookToken,
} from '@/lib/payments/moyasar'
import { round2 } from '@/lib/utils'

type MoyasarWebhook = {
  type?: string
  secret_token?: string
  data?: {
    id?: string
    metadata?: Record<string, string> | null
  }
}

export async function POST(req: NextRequest) {
  let event: MoyasarWebhook
  let rawBody = ''
  try {
    rawBody = await req.text()
    event = JSON.parse(rawBody) as MoyasarWebhook
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return new NextResponse('Invalid payload', { status: 400 })
  }

  let paymentEventId = ''
  try {
    const webhookSecret = getMoyasarWebhookSecret()

    if (!webhookSecret) {
      console.error('Moyasar webhook secret is not configured')
      return new NextResponse('Webhook secret not configured', { status: 503 })
    }

    if (!verifyMoyasarWebhookToken(event.secret_token, webhookSecret)) {
      return new NextResponse('Invalid webhook token', { status: 401 })
    }

    if (
      event.type !== 'payment_paid' &&
      event.type !== 'payment_captured' &&
      event.type !== 'payment_refunded'
    ) {
      return NextResponse.json({ received: true })
    }

    const eventKey = crypto
      .createHash('sha256')
      .update(rawBody)
      .digest('hex')
    const recorded = await beginPaymentEvent({
      provider: 'moyasar',
      eventId: eventKey,
      type: event.type,
    })
    if (recorded.duplicate) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    paymentEventId = String(recorded.event._id)

    const respond = async (
      status: 'processed' | 'ignored' | 'failed',
      message = ''
    ) => {
      await finishPaymentEvent(paymentEventId, status, message)
      return NextResponse.json({ received: true })
    }

    const paymentId = event.data?.id
    if (!paymentId) {
      return respond('ignored', 'Missing payment id')
    }

    // Never trust the webhook body alone: fetch the payment from Moyasar and
    // take the order reference from the gateway's copy of the metadata.
    const payment = await fetchMoyasarPayment(paymentId)

    const orderId = payment.metadata?.orderId
    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      console.error('Moyasar webhook payment has no valid order metadata')
      return respond('ignored', 'Missing order metadata')
    }
    await attachPaymentEventOrder(paymentEventId, orderId)

    await connectToDatabase()

    const order = await Order.findById(orderId)
    if (!order) {
      return respond('ignored', 'Order not found')
    }

    if (event.type === 'payment_refunded') {
      if (!order.isPaid) {
        throw new Error('Refund received before the order was paid')
      }
      // Keep the order in sync when a refund is issued from the dashboard.
      const refundedAmount = round2((payment.refunded ?? 0) / 100)
      const refundedAt = new Date()
      let current = order
      let refundDelta = 0

      for (let attempt = 0; attempt < 3; attempt++) {
        const previousRefunded = round2(current.refundedAmount ?? 0)
        if (refundedAmount <= previousRefunded) {
          return respond('ignored', 'Refund already recorded')
        }
        if (refundedAmount > round2(current.totalPrice) + 0.01) {
          return respond('ignored', 'Refund exceeds the order total')
        }

        refundDelta = round2(refundedAmount - previousRefunded)
        const fullRefund =
          refundedAmount >= round2(current.totalPrice) - 0.01
        const updated = await Order.findOneAndUpdate(
          { _id: current._id, refundedAmount: previousRefunded },
          {
            $set: {
              refundedAmount,
              refundedAt,
              ...(fullRefund
                ? {
                    status: 'refunded',
                    shippingRefunded: true,
                    paymentResult: {
                      id: current.paymentResult?.id ?? payment.id,
                      status: 'refunded',
                      email_address:
                        current.paymentResult?.email_address ?? '',
                      pricePaid:
                        current.paymentResult?.pricePaid ??
                        current.totalPrice.toFixed(2),
                    },
                  }
                : {}),
            },
            $push: {
              refundHistory: {
                amount: refundDelta,
                provider: 'Moyasar',
                refundedAt,
                reason: 'Moyasar dashboard refund',
                reference: payment.id,
              },
              statusHistory: {
                status: fullRefund ? 'refunded' : current.status ?? 'paid',
                at: refundedAt,
                note: `Moyasar refund ${refundedAmount.toFixed(2)} ${current.currency}`,
              },
            },
          },
          { new: true }
        )
        if (updated) {
          current = updated
          refundDelta = round2(refundedAmount - previousRefunded)
          break
        }
        const reloaded = await Order.findById(orderId)
        if (!reloaded) return respond('ignored', 'Order not found')
        current = reloaded
        if (attempt === 2)
          throw new Error('Moyasar refund reconciliation contention')
      }

      try {
        const creditNote = await createInvoiceForOrder(orderId, 'credit_note', {
          eventId: `moyasar-refund:${payment.id}:${refundedAmount.toFixed(2)}`,
          reason: 'return',
          refundedAmount: refundDelta,
          notes: 'Moyasar dashboard refund',
        })
        await queueZatcaForInvoice(String(creditNote._id))
      } catch (error) {
        console.error(
          'Moyasar webhook credit note failed:',
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
      return respond('processed')
    }

    if (!isMoyasarPaid(payment.status) || order.isPaid || order.isCancelled) {
      return respond('ignored', 'Payment not payable or order closed')
    }

    if (order.paymentMethod !== 'Moyasar') {
      console.error('Moyasar webhook received for a non-Moyasar order')
      return respond('ignored', 'Order is not a Moyasar order')
    }

    if (payment.amount !== toMoyasarAmount(order.totalPrice)) {
      console.error('Moyasar webhook amount does not match the order total')
      return respond('ignored', 'Amount mismatch')
    }

    if (
      payment.currency.toUpperCase() !==
      (order.currency || 'SAR').toUpperCase()
    ) {
      console.error('Moyasar webhook currency does not match the order')
      return respond('ignored', 'Currency mismatch')
    }

    await Order.findByIdAndUpdate(orderId, {
      moyasarPaymentId: payment.id,
    })

    await fulfillOrder({
      orderId,
      provider: 'Moyasar',
      paymentId: payment.id,
      amountPaid: payment.amount / 100,
      currency: payment.currency,
      email: '',
      status: payment.status,
    })

    return respond('processed')
  } catch (error) {
    await finishPaymentEvent(
      paymentEventId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    )
    console.error('Moyasar webhook fulfillment failed:', error)
    return new NextResponse('Fulfillment failed', { status: 500 })
  }
}
