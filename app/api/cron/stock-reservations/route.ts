import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import { releaseExpiredReservations } from '@/lib/orders/stock-reservations'

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 503 }
    )
  }
  if (
    !timingSafeEqual(
      req.headers.get('authorization') ?? '',
      `Bearer ${secret}`
    )
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const released = await releaseExpiredReservations()
  return NextResponse.json({ released })
}
