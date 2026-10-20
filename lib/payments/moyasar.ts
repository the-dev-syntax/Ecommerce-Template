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
  fee?: number
  currency: string
  refunded?: number
  refunded_at?: string | null
  captured?: number
  captured_at?: string | null
  voided_at?: string | null
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

async function moyasarRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const secretKey = getMoyasarSecretKey()
  const response = await fetch(`${MOYASAR_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(secretKey),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    let message = `Moyasar request failed (${response.status})`
    try {
      const body = (await response.json()) as {
        message?: string | null
        errors?: Record<string, string[]> | null
      }
      if (body.message) message = body.message
      if (body.errors) {
        const details = Object.entries(body.errors)
          .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
          .join('; ')
        if (details) message = `${message} (${details})`
      }
    } catch {
      // Keep the status-based message when the body is not JSON.
    }
    throw new Error(message)
  }

  return (await response.json()) as T
}

export async function fetchMoyasarPayment(id: string): Promise<MoyasarPayment> {
  return moyasarRequest<MoyasarPayment>(
    `/payments/${encodeURIComponent(id)}`
  )
}

/** Refund a captured payment. Omit amount to refund the full remaining amount. */
export async function refundMoyasarPayment(
  id: string,
  amount?: number
): Promise<MoyasarPayment> {
  return moyasarRequest<MoyasarPayment>(
    `/payments/${encodeURIComponent(id)}/refund`,
    {
      method: 'POST',
      body: amount ? JSON.stringify({ amount }) : undefined,
    }
  )
}

/** Void an authorized payment before it is captured. */
export async function voidMoyasarPayment(id: string): Promise<MoyasarPayment> {
  return moyasarRequest<MoyasarPayment>(
    `/payments/${encodeURIComponent(id)}/void`,
    { method: 'POST' }
  )
}

export function isMoyasarPaid(status: string): boolean {
  return status === 'paid' || status === 'captured'
}

/**
 * Moyasar finalises a payment after one refund call (partial or full), so a
 * second refund is rejected with "Payment is already refunded".
 */
export function isMoyasarRefundable(status: string): boolean {
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
