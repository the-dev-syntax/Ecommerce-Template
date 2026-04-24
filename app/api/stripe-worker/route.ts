import { sendPurchaseReceipt } from '@/emails'
import Order from '@/lib/db/models/order.model'
import { connectToDatabase } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'




export async function POST(req: NextRequest) {
  const { event } = await req.json()

  if (event.type !== 'charge.succeeded') return NextResponse.json({ ok: true })

  await connectToDatabase()

  const charge = event.data.object
  const order = await Order.findById(charge.metadata.orderId)

  if (!order || order.isPaid) {
    return NextResponse.json({ ok: true })
  }

  order.isPaid = true
  order.paidAt = new Date()
  await order.save()

  await sendPurchaseReceipt({ order })

  return NextResponse.json({ ok: true })
}