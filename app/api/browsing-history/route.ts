import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { mergeBrowsingHistory } from '@/lib/browsing-history'

// Used only by navigator.sendBeacon on pagehide/tab-close.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false })

  try {
    const body = await request.json()
    const items = Array.isArray(body?.items) ? body.items : []
    await mergeBrowsingHistory(session.user.id, items)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
