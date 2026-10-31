import crypto from 'crypto'

export const RECOVERY_MAX_ATTEMPTS = 5
export const RECOVERY_STALE_PROCESSING_MS = 10 * 60 * 1000

export type RecoveryOutcome =
  | 'refunded'
  | 'manual_review'
  | 'retry'
  | 'in_progress'
  | 'already_refunded'

export type RecoveryResult = {
  outcome: RecoveryOutcome
  message: string
  refundId?: string
}

export function recoveryRefundKey(orderId: string, paymentId: string) {
  return `recovery:${orderId}:${paymentId}`
}

/** Normalize stored provider labels without importing DB/payment modules. */
export function normalizedProvider(provider: string) {
  const value = provider.trim().toLowerCase()
  if (value.includes('stripe')) return 'stripe'
  if (value.includes('paypal')) return 'paypal'
  if (value.includes('moyasar')) return 'moyasar'
  if (value.includes('cash') || value === 'cod') return 'cod'
  return value
}

export function isRetryableRecoveryError(error: unknown): boolean {
  const value = error as {
    status?: number
    statusCode?: number
    message?: string
  }
  const status = value?.statusCode ?? value?.status
  if (status === 408 || status === 425 || status === 429 || (status ?? 0) >= 500)
    return true
  if ((status ?? 0) >= 400 && (status ?? 0) < 500) return false

  const message = String(value?.message ?? error ?? '')
  if (
    /network|fetch failed|timeout|timed out|econn|enotfound|socket|rate.?limit|too many|429|5\d\d/i.test(
      message
    )
  )
    return true

  // Unknown provider/transport failures are retried until the attempt cap,
  // then escalated to manual review. A captured payment is never discarded.
  return true
}

export function recoveryFailureOutcome(
  retryable: boolean,
  attempts: number
): 'pending' | 'manual_review' {
  return retryable && attempts < RECOVERY_MAX_ATTEMPTS
    ? 'pending'
    : 'manual_review'
}

type ClaimableOrder = {
  status?: string
  recoveryRefundKey?: string
  recoveryRefundStatus?: string
  recoveryRefundAttempts?: number
  recoveryRefundLastAttemptAt?: Date | string | null
  refundedAmount?: number
  totalPrice?: number
}

/**
 * Pure mirror of the atomic claim conditions in recoverCapturedPayment().
 * A second webhook arriving while a refund is actively processing cannot claim
 * the order; a stale processing claim can be retried by the cron.
 */
export function canClaimRecovery(
  order: ClaimableOrder,
  key: string,
  now = new Date()
): boolean {
  if (order.status === 'refunded' || order.status === 'manual_review')
    return false
  if (
    order.recoveryRefundStatus === 'refunded' ||
    order.recoveryRefundStatus === 'manual_review'
  )
    return false
  if (
    (order.refundedAmount ?? 0) >= (order.totalPrice ?? 0) - 0.01 &&
    (order.totalPrice ?? 0) > 0
  )
    return false
  if ((order.recoveryRefundAttempts ?? 0) >= RECOVERY_MAX_ATTEMPTS)
    return false
  if (!order.recoveryRefundKey) return true
  if (order.recoveryRefundKey !== key) return false
  if (order.recoveryRefundStatus === 'processing') {
    const lastAttempt = order.recoveryRefundLastAttemptAt
      ? new Date(order.recoveryRefundLastAttemptAt).getTime()
      : 0
    return now.getTime() - lastAttempt >= RECOVERY_STALE_PROCESSING_MS
  }
  return true
}

/** PayPal caps request ids at 38 characters; keep retries stable. */
export function paypalRequestId(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 38)
}
