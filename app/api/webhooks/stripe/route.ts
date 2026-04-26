

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
// import { Client } from '@upstash/qstash'
import { sendPurchaseReceipt } from '@/emails'
import { connectToDatabase } from '@/lib/db'
import Order from '@/lib/db/models/order.model'


console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAA from Stripe Webhook Route")

export async function POST(req: NextRequest) {

  await connectToDatabase()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

  // removed await before stripe.webhooks.constructEvent
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    req.headers.get('stripe-signature') as string,
    process.env.STRIPE_WEBHOOK_SECRET as string
  )
  console.log("BBBBBBBBBBBBBBBBBBBBBBBBBBB from Stripe Webhook Route, event:", event)
  
  if (event.type === 'charge.succeeded') {
    const charge = event.data.object
    const orderId = charge.metadata.orderId
    const email = charge.billing_details.email
    const pricePaidInCents = charge.amount
    console.log("CCCCCCCCCCCCCCCCCCCCCCCCCCC from Stripe Webhook Route, order:", orderId)
    const order = await Order.findById(orderId).populate('user', 'email')

    if (order == null) {
      return new NextResponse('Bad Request', { status: 400 })
    }

    order.isPaid = true
    order.paidAt = new Date()
    order.paymentResult = {
      id: event.id,
      status: 'COMPLETED',
      email_address: email || "",
      pricePaid: (pricePaidInCents / 100).toFixed(2),
    }

    console.log("DDDDDDDDDDDDDDDDDDDDDDDDD from Stripe Webhook Route, order:", order)

    await order.save()

    try {
        await sendPurchaseReceipt({ order })
        console.log("EEEEEEEEEEEEEEEEEEEEEEEEEEE from Stripe Webhook Route, sendPurchaseReceipt commented out for testing")
      
    } catch (err) {
        console.log('email error', err)
    }
    return NextResponse.json({ message: 'updateOrderToPaid was successful'})
  }

  return new NextResponse()
}















/*
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
  } catch (error) {
    console.log('stripe.webhooks.constructEvent failed:',error)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  console.log("Received Webhook Event Type:", event.type)

  if (event.type === 'payment_intent.succeeded' || event.type === 'charge.succeeded') {
   
    const dataObject = event.data.object; // Temporary 'any' to find where metadata is
    
    console.log("Full Data Object Metadata:", dataObject.metadata)
    
    const orderId = dataObject.metadata?.orderId

    if (!orderId) {
      console.error("No orderId found in this event object's metadata")
      // If you are using Checkout, you might need to look at checkout.session.completed instead
      return NextResponse.json({ received: true })
    }

    console.log("Pushing to QStash for Order:", orderId)

    client.publishJSON({
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/stripe-worker`,
      body: { 
        orderId: orderId,
        type: event.type 
      },
    })
  }
    return NextResponse.json({ received: true })
}
*/
    /*
    // 2. Cast the object to Stripe.Charge so TS knows metadata exists
    const charge = event.data.object as Stripe.Charge
    
    const orderId = charge.metadata?.orderId

    console.log("charge:",charge)
    console.log("charge.metadata:",charge.metadata)
    console.log("charge.metadata.orderId:",charge.metadata?.orderId)

    if (!orderId) {
       console.error("No orderId found in metadata")
       return NextResponse.json({ received: true })
    }

    // 3. Send only the data the worker needs (Cleaner & safer)
    await client.publishJSON({
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/stripe-worker`,
      body: { 
        orderId: orderId,
        type: event.type 
      },
    })
  }
  */
    // respond immediately to avoid timeouts, the actual processing will be done in the worker



/*
  client.publishJSON({
  url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/stripe-worker`,
  body: {
    type: event.type,
    data: {
      object: {
        metadata: event.data.object.metadata,
      },
    },
  },
})

  // push job to queue
  await client.publishJSON({
    url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/stripe-worker`,
    body: { event },
  })
*/
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
