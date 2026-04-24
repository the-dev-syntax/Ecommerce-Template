import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Client } from '@upstash/qstash'
// import '@/lib/db/models/user.model'



const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

const client = new Client({ token: process.env.QSTASH_TOKEN as string})

export async function POST(req: NextRequest) {
  const body = await req.text()

  let event: Stripe.Event
  try {
      event = stripe.webhooks.constructEvent(
      body,
      req.headers.get('stripe-signature')!,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return new NextResponse('Invalid signature', { status: 400 })
  }

  // push job to queue
  await client.publishJSON({
    url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/stripe-worker`,
    body: { event },
  })

    // respond immediately to avoid timeouts, the actual processing will be done in the worker
  return NextResponse.json({ received: true })
}

/*
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export async function POST(req: NextRequest) {

  await connectToDatabase()
  // removed await before stripe.webhooks.constructEvent
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    req.headers.get('stripe-signature') as string,
    process.env.STRIPE_WEBHOOK_SECRET as string
  )

  if (event.type === 'charge.succeeded') {
    const charge = event.data.object
    const orderId = charge.metadata.orderId
    const email = charge.billing_details.email
    const pricePaidInCents = charge.amount
    const order = await Order.findById(orderId).populate('user', 'email')

    if (order == null) {
      return new NextResponse('Bad Request', { status: 400 })
    }

    order.isPaid = true
    order.paidAt = new Date()
    order.paymentResult = {
      id: event.id,
      status: 'COMPLETED',
      email_address: email!,
      pricePaid: (pricePaidInCents / 100).toFixed(2),
    }

    await order.save()

    try {
        await sendPurchaseReceipt({ order })
  
    } catch (err) {
        console.log('email error', err)
    }
    return NextResponse.json({ message: 'updateOrderToPaid was successful'})
  }

  return new NextResponse()
}

*/