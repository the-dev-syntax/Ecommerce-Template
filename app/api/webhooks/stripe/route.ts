import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { sendPurchaseReceipt } from '@/emails'
import { connectToDatabase } from '@/lib/db'
import Order from '@/lib/db/models/order.model'
import Product from '@/lib/db/models/product.model'
import mongoose from 'mongoose'

export async function POST(req: NextRequest) {
  await connectToDatabase()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

  // ✅ Validate the webhook signature — return 400 if invalid instead of crashing
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

  if (event.type === 'charge.succeeded') {
    const charge = event.data.object
    const orderId = charge.metadata.orderId
    const email = charge.billing_details.email
    const pricePaidInCents = charge.amount

    const order = await Order.findById(orderId).populate('user', 'email')

    if (order == null) {
      return new NextResponse('Order not found', { status: 400 })
    }

    // Idempotency guard — Stripe may send duplicate events
    if (order.isPaid) {
      return NextResponse.json({ message: 'Order already paid' })
    }

    order.isPaid = true
    order.paidAt = new Date()
    order.paymentResult = {
      id: event.id,
      status: 'COMPLETED',
      email_address: email || '',
      pricePaid: (pricePaidInCents / 100).toFixed(2),
    }

    await order.save()

    // ✅ Decrement product stock — mirrors the PayPal flow
    try {
      await updateProductStock(order._id)
    } catch (stockErr) {
      console.error('Stock update failed after Stripe payment (order still paid):', stockErr)
    }

    // Send receipt — failure must never surface as a payment error
    try {
      await sendPurchaseReceipt({ order })
    } catch (emailErr) {
      console.error('Purchase receipt email failed (order still paid):', emailErr)
    }

    return NextResponse.json({ message: 'Order marked as paid successfully' })
  }

  return new NextResponse(null, { status: 200 })
}

// Decrement countInStock for each item in the order using a transaction
async function updateProductStock(orderId: string) {
  const session = await mongoose.connection.startSession()
  try {
    session.startTransaction()
    const opts = { session }

    const order = await Order.findById(orderId).session(session)
    if (!order) throw new Error('Order not found')

    for (const item of order.items) {
      const product = await Product.findById(item.product).session(session)
      if (!product) throw new Error(`Product not found: ${item.product}`)
      product.countInStock -= item.quantity
      await Product.updateOne(
        { _id: product._id },
        { countInStock: product.countInStock },
        opts
      )
    }

    await session.commitTransaction()
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}















