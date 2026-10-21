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
  const handler = handlers[provider.toLowerCase()]
  if (!handler) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }
  return handler(req)
}
