import { NextRequest, NextResponse } from 'next/server'

import { POST as moyasarWebhook } from '../../moyasar/route'
import { POST as stripeWebhook } from '../../stripe/route'

const handlers: Record<string, (req: NextRequest) => Promise<Response>> = {
  moyasar: moyasarWebhook,
  stripe: stripeWebhook,
  mock: async () => NextResponse.json({ received: true, mock: true }),
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params
  const normalized = provider.toLowerCase()

  // The mock provider is a development/test helper only. Do not expose even a
  // no-op webhook route in production.
  if (normalized === 'mock' && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  const handler = handlers[normalized]
  if (!handler) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }
  return handler(req)
}
