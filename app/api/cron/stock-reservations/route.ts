import { NextRequest, NextResponse } from 'next/server'

import { releaseExpiredReservations } from '@/lib/orders/stock-reservations'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 503 }
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const released = await releaseExpiredReservations()
  return NextResponse.json({ released })
}
