import crypto from 'crypto'

import { getMoyasarSecretKey } from '@/lib/env'

const MOYASAR_API_BASE = 'https://api.moyasar.com/v1'

export type MoyasarPaymentStatus =
  | 'initiated'
  | 'paid'
  | 'authorized'
  | 'failed'
  | 'refunded'
  | 'captured'
  | 'voided'
  | 'verified'
  | 'expired'

export interface MoyasarPayment {
  id: string
  status: MoyasarPaymentStatus
  amount: number
  currency: string
  description?: string | null
  metadata?: Record<string, string> | null
  source?: {
    type?: string
    company?: string
    number?: string
    message?: string | null
    transaction_url?: string | null
  } | null
  created_at?: string
  updated_at?: string
}

function authHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

export async function fetchMoyasarPayment(id: string): Promise<MoyasarPayment> {
  const secretKey = getMoyasarSecretKey()

  const response = await fetch(
    `${MOYASAR_API_BASE}/payments/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: authHeader(secretKey) },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    throw new Error(`Moyasar payment lookup failed (${response.status})`)
  }

  return (await response.json()) as MoyasarPayment
}

export function isMoyasarPaid(status: string): boolean {
  return status === 'paid' || status === 'captured'
}

/** Moyasar expects the amount in the currency's smallest unit. */
export function toMoyasarAmount(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * Moyasar webhooks carry the configured secret token in the body. Compare it
 * in constant time; the endpoint must also be HTTPS (enforced by Moyasar).
 */
export function verifyMoyasarWebhookToken(
  received: string | undefined,
  expected: string | undefined
): boolean {
  if (!received || !expected) return false

  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)

  return (
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  )
}
