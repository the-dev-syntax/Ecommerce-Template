import { notFound } from 'next/navigation'
import React from 'react'

import { auth } from '@/auth'
import { getOrderById } from '@/lib/actions/order.actions'
import PaymentForm from './payment-form'
import Stripe from 'stripe'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Payment',
}

const CheckoutPaymentPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params
  const { id } = params

  // Parallelize order fetch and auth check
  const [order, session] = await Promise.all([
    getOrderById(id),
    auth(),
  ])
  
  if (!order) notFound()

  let client_secret = null
  if (order.paymentMethod === 'Stripe' && !order.isPaid) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalPrice * 100),
      currency: 'USD',
      metadata: { orderId: order._id },
    })
    
    client_secret = paymentIntent.client_secret
  }
  return (
    <PaymentForm
      order={order}
      paypalClientId={process.env.PAYPAL_CLIENT_ID || 'sb'}
      isAdmin={session?.user?.role === 'admin' || false}
      clientSecret = { client_secret }
    />
  )
}

export default CheckoutPaymentPage
