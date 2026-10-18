import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { fulfillOrder } from '@/lib/orders/fulfill-order'

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      req.headers.get('stripe-signature') as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata.orderId

      if (!orderId) {
        console.error('Stripe payment intent has no orderId:', paymentIntent.id)
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
        const paymentIntent = await stripe.paymentIntents.retrieve(
          charge.payment_intent
        )
        orderId = paymentIntent.metadata.orderId
      }

      if (!orderId) {
        console.error('Stripe charge has no orderId:', charge.id)
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
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook fulfillment failed:', error)
    // Returning 500 lets Stripe retry the event.
    return new NextResponse('Fulfillment failed', { status: 500 })
  }
}
