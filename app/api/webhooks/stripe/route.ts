import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { fulfillOrder } from '@/lib/orders/fulfill-order'
import { beginPaymentEvent, finishPaymentEvent } from '@/lib/payments/events'
import {
  constructStripeWebhook,
  retrieveStripeCharge,
  retrieveStripeIntent,
} from '@/lib/payments/stripe'
import Order from '@/lib/db/models/order.model'

export async function POST(req: NextRequest) {
  let event: Stripe.Event
  try {
    event = constructStripeWebhook(
      await req.text(),
      req.headers.get('stripe-signature') as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  let paymentEventId = ''
  try {
    const recorded = await beginPaymentEvent({
      provider: 'stripe',
      eventId: event.id,
      type: event.type,
    })
    if (recorded.duplicate) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    paymentEventId = String(recorded.event._id)

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata.orderId

      if (!orderId) {
        console.error('Stripe payment intent has no orderId:', paymentIntent.id)
        await finishPaymentEvent(paymentEventId, 'ignored', 'Missing orderId')
        return NextResponse.json({ received: true })
      }

      const result = await fulfillOrder({
        orderId,
        provider: 'Stripe',
        paymentId: paymentIntent.id,
        amountPaid: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        email: paymentIntent.receipt_email ?? '',
        status: paymentIntent.status,
      })

      await finishPaymentEvent(paymentEventId, 'processed')
      return NextResponse.json({
        received: true,
        alreadyPaid: result.alreadyPaid,
      })
    }

    // Backward-compatible fallback if the endpoint is still subscribed to charges.
    if (event.type === 'charge.succeeded') {
      const charge = event.data.object as Stripe.Charge
      if (!charge.paid) return NextResponse.json({ received: true })

      let orderId = charge.metadata.orderId
      if (!orderId && typeof charge.payment_intent === 'string') {
        const paymentIntent = await retrieveStripeIntent(
          charge.payment_intent
        )
        orderId = paymentIntent.metadata.orderId
      }

      if (!orderId) {
        console.error('Stripe charge has no orderId:', charge.id)
        await finishPaymentEvent(paymentEventId, 'ignored', 'Missing orderId')
        return NextResponse.json({ received: true })
      }

      const result = await fulfillOrder({
        orderId,
        provider: 'Stripe',
        paymentId: charge.id,
        amountPaid: charge.amount / 100,
        currency: charge.currency,
        email: charge.billing_details?.email ?? '',
        status: 'COMPLETED',
      })

      await finishPaymentEvent(paymentEventId, 'processed')
      return NextResponse.json({
        received: true,
        alreadyPaid: result.alreadyPaid,
      })
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      console.error(
        'Stripe payment failed:',
        paymentIntent.id,
        paymentIntent.last_payment_error?.message
      )
      await finishPaymentEvent(
        paymentEventId,
        'processed',
        'Payment failed event logged'
      )
    }

    if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
      const dispute = event.data.object as Stripe.Dispute
      let orderId = ''
      if (typeof dispute.charge === 'string') {
        const charge = await retrieveStripeCharge(dispute.charge)
        orderId = charge.metadata.orderId
      }
      if (orderId) {
        await Order.updateOne(
          { _id: orderId },
          {
            $set: {
              isDisputed: event.type === 'charge.dispute.created',
              disputeStatus: dispute.status,
              disputedAt: new Date(),
            },
          }
        )
      }
      await finishPaymentEvent(
        paymentEventId,
        'processed',
        `Dispute ${dispute.status}`
      )
      return NextResponse.json({ received: true })
    }

    await finishPaymentEvent(paymentEventId, 'ignored')
    return NextResponse.json({ received: true })
  } catch (error) {
    await finishPaymentEvent(
      paymentEventId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    )
    console.error('Stripe webhook fulfillment failed:', error)
    // Returning 500 lets Stripe retry the event.
    return new NextResponse('Fulfillment failed', { status: 500 })
  }
}
