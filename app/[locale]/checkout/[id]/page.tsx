import { notFound } from 'next/navigation'
import React from 'react'
import { auth } from '@/auth'
import { getOrderById } from '@/lib/actions/order.actions'
import PaymentForm from './payment-form'


// Force dynamic rendering
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Payment',
}

const CheckoutPaymentPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params
  const { id } = params


  const session = await auth()
  
  const order = await getOrderById(id)
  if (!order) notFound()

  return (
    <PaymentForm
      order={order}
      paypalClientId={process.env.PAYPAL_CLIENT_ID || 'sb'}
      isAdmin={session?.user?.role === 'admin' || false}
     
    />
  )
}

export default CheckoutPaymentPage
