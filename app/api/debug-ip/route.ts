import { NextResponse } from 'next/server'

import { pickClientIp } from '@/lib/client-ip'

// Temporary diagnostic route for P0-7 (trusted client IP header).
// Inert in production; delete after the header decision is documented.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }

  const headers = request.headers

  return NextResponse.json({
    headers: {
      'x-forwarded-for': headers.get('x-forwarded-for'),
      'x-vercel-forwarded-for': headers.get('x-vercel-forwarded-for'),
      'x-real-ip': headers.get('x-real-ip'),
      'true-client-ip': headers.get('true-client-ip'),
      'cf-connecting-ip': headers.get('cf-connecting-ip'),
    },
    pickedIp: pickClientIp(
      (name) => headers.get(name),
      process.env.TRUSTED_IP_HEADER
    ),
    trustedHeader: process.env.TRUSTED_IP_HEADER ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  })
}
