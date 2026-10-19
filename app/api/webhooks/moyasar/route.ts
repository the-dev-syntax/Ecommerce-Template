import mongoose from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'

import { connectToDatabase } from '@/lib/db'
import Order from '@/lib/db/models/order.model'
import { getMoyasarWebhookSecret } from '@/lib/env'
import { fulfillOrder } from '@/lib/orders/fulfill-order'
import {
  fetchMoyasarPayment,
  isMoyasarPaid,
  toMoyasarAmount,
  verifyMoyasarWebhookToken,
} from '@/lib/payments/moyasar'

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
  try {
    event = (await req.json()) as MoyasarWebhook
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return new NextResponse('Invalid payload', { status: 400 })
  }

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
      event.type !== 'payment_captured'
    ) {
      return NextResponse.json({ received: true })
    }

    const paymentId = event.data?.id
    if (!paymentId) {
      return NextResponse.json({ received: true })
    }

    // Never trust the webhook body alone: fetch the payment from Moyasar and
    // take the order reference from the gateway's copy of the metadata.
    const payment = await fetchMoyasarPayment(paymentId)
    if (!isMoyasarPaid(payment.status)) {
      return NextResponse.json({ received: true })
    }

    const orderId = payment.metadata?.orderId
    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      console.error('Moyasar webhook payment has no valid order metadata')
      return NextResponse.json({ received: true })
    }

    await connectToDatabase()

    const order = await Order.findById(orderId)
    if (!order || order.isPaid) {
      return NextResponse.json({ received: true })
    }

    if (order.paymentMethod !== 'Moyasar') {
      console.error('Moyasar webhook received for a non-Moyasar order')
      return NextResponse.json({ received: true })
    }

    if (payment.amount !== toMoyasarAmount(order.totalPrice)) {
      console.error('Moyasar webhook amount does not match the order total')
      return NextResponse.json({ received: true })
    }

    if (
      payment.currency.toUpperCase() !==
      (order.currency || 'SAR').toUpperCase()
    ) {
      console.error('Moyasar webhook currency does not match the order')
      return NextResponse.json({ received: true })
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

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Moyasar webhook fulfillment failed:', error)
    return new NextResponse('Fulfillment failed', { status: 500 })
  }
}
