


import { sendPurchaseReceipt } from '@/emails'
import { connectToDatabase } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { dbOrderWith3UserKeys } from '@/lib/actions/order.actions'




export async function POST(req: NextRequest) {

  const { event } = await req.json()

  if (event.type !== 'charge.succeeded') return NextResponse.json({ ok: true })

  await connectToDatabase()

  const charge = event.data.object
  
  const order = await dbOrderWith3UserKeys(charge.metadata.orderId)  

  if (!order || order.isPaid) {
    return NextResponse.json({ ok: true })
  }

  order.isPaid = true
  order.paidAt = new Date()
  await order.save()

  await sendPurchaseReceipt({ order })

  return NextResponse.json({ ok: true })
}
