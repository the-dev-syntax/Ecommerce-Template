import { sendPaymentRecoveryEmail } from '@/emails'
import { connectToDatabase } from '@/lib/db'
import Order, { type OrderWithUser } from '@/lib/db/models/order.model'
import { beginPaymentEvent, finishPaymentEvent } from '@/lib/payments/events'
import {
  fetchMoyasarPayment,
  isMoyasarRefundable,
  refundMoyasarPayment,
  toMoyasarAmount,
  voidMoyasarPayment,
} from '@/lib/payments/moyasar'
import { paypal } from '@/lib/paypal'
import {
  listStripeRefunds,
  refundStripePayment,
  retrieveStripeIntent,
} from '@/lib/payments/stripe'
import {
  RECOVERY_MAX_ATTEMPTS,
  RECOVERY_STALE_PROCESSING_MS,
  canClaimRecovery,
  isRetryableRecoveryError,
  normalizedProvider,
  paypalRequestId,
  recoveryFailureOutcome,
  recoveryRefundKey,
  type RecoveryOutcome,
  type RecoveryResult,
} from './payment-recovery-state'
import { round2 } from '@/lib/utils'

const RETRY_DELAY_MS = 2 * 60 * 1000

export {
  RECOVERY_MAX_ATTEMPTS,
  RECOVERY_STALE_PROCESSING_MS,
  isRetryableRecoveryError,
  recoveryRefundKey,
} from './payment-recovery-state'
export type { RecoveryOutcome, RecoveryResult } from './payment-recovery-state'

type ProviderRefundResult = {
  status: 'succeeded' | 'pending' | 'failed'
  refundId?: string
  message?: string
  retryable?: boolean
}

type PayPalCapture = {
  id?: string
  status?: string
  amount?: { value?: string; currency_code?: string }
}

type PayPalOrder = {
  purchase_units?: Array<{
    payments?: { captures?: PayPalCapture[] }
  }>
}

type PayPalRefund = {
  id?: string
  status?: string
}

export class RecoveryRetryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecoveryRetryError'
  }
}

async function refundWithProvider(input: {
  provider: string
  orderId: string
  paymentId: string
  amount: number
  currency: string
  key: string
}): Promise<ProviderRefundResult> {
  const provider = normalizedProvider(input.provider)

  if (provider === 'stripe') {
    const intent = await retrieveStripeIntent(input.paymentId)
    if (intent.status !== 'succeeded') {
      return {
        status: 'failed',
        message: `Stripe payment is ${intent.status}, not captured`,
        retryable: false,
      }
    }
    if (intent.metadata.orderId !== input.orderId) {
      return {
        status: 'failed',
        message: 'Stripe payment intent does not belong to this order',
        retryable: false,
      }
    }
    if (
      Math.abs(intent.amount / 100 - input.amount) > 0.01 ||
      intent.currency.toUpperCase() !== input.currency.toUpperCase()
    ) {
      return {
        status: 'failed',
        message: 'Stripe payment amount/currency does not match the order',
        retryable: false,
      }
    }

    const existing = await listStripeRefunds(input.paymentId)
    const succeeded = existing.data
      .filter((refund) => refund.status === 'succeeded')
      .reduce((total, refund) => total + refund.amount, 0)
    if (succeeded >= Math.round(input.amount * 100) - 1) {
      return {
        status: 'succeeded',
        refundId: existing.data.find((refund) => refund.status === 'succeeded')
          ?.id,
      }
    }
    if (succeeded > 0) {
      return {
        status: 'failed',
        message:
          'Stripe payment was partially refunded; manual review required',
        retryable: false,
      }
    }
    const pending = existing.data.find((refund) => refund.status === 'pending')
    if (pending) return { status: 'pending', refundId: pending.id }

    const refund = await refundStripePayment({
      paymentIntentId: input.paymentId,
      amount: input.amount,
      idempotencyKey: input.key,
    })
    if (refund.status === 'succeeded')
      return { status: 'succeeded', refundId: refund.id }
    if (refund.status === 'pending')
      return { status: 'pending', refundId: refund.id }
    return {
      status: 'failed',
      refundId: refund.id,
      message: `Stripe refund is ${refund.status}`,
      retryable: false,
    }
  }

  if (provider === 'paypal') {
    let captureId = input.paymentId
    let capture: PayPalCapture | null = null

    try {
      capture = (await paypal.getCapture(captureId)) as PayPalCapture
    } catch (error) {
      // Some older orders stored the PayPal order id instead of the capture
      // id. Resolve the capture from the order once.
      if ((error as { status?: number }).status === 404) {
        const order = (await paypal.getOrder(input.paymentId)) as PayPalOrder
        const resolved =
          order?.purchase_units?.[0]?.payments?.captures?.[0]
        if (!resolved?.id) {
          return {
            status: 'failed',
            message: 'PayPal capture was not found',
            retryable: false,
          }
        }
        captureId = resolved.id
        capture = resolved
      } else {
        throw error
      }
    }

    if (capture?.status === 'REFUNDED') {
      return { status: 'succeeded', refundId: captureId }
    }
    if (capture?.status === 'PARTIALLY_REFUNDED') {
      return {
        status: 'failed',
        message: 'PayPal capture was partially refunded; manual review required',
        retryable: false,
      }
    }
    if (capture?.status !== 'COMPLETED') {
      return {
        status: 'failed',
        message: `PayPal capture is ${capture?.status ?? 'unknown'}`,
        retryable: false,
      }
    }
    if (
      Math.abs(Number(capture?.amount?.value ?? 0) - input.amount) > 0.01 ||
      String(capture?.amount?.currency_code ?? '').toUpperCase() !==
        input.currency.toUpperCase()
    ) {
      return {
        status: 'failed',
        message: 'PayPal capture amount/currency does not match the order',
        retryable: false,
      }
    }

    const refund = (await paypal.refundCapture(
      captureId,
      input.amount,
      input.currency,
      paypalRequestId(input.key)
    )) as PayPalRefund
    if (refund.status === 'COMPLETED')
      return { status: 'succeeded', refundId: refund.id ?? captureId }
    if (refund.status === 'PENDING')
      return { status: 'pending', refundId: refund.id ?? captureId }
    return {
      status: 'failed',
      refundId: refund.id,
      message: `PayPal refund is ${refund.status}`,
      retryable: false,
    }
  }

  if (provider === 'moyasar') {
    const payment = await fetchMoyasarPayment(input.paymentId)
    if (payment.metadata?.orderId !== input.orderId) {
      return {
        status: 'failed',
        message: 'Moyasar payment does not belong to this order',
        retryable: false,
      }
    }
    const requested = toMoyasarAmount(input.amount)
    if ((payment.refunded ?? 0) >= requested) {
      return { status: 'succeeded', refundId: payment.id }
    }
    if ((payment.refunded ?? 0) > 0) {
      return {
        status: 'failed',
        message:
          'Moyasar payment was partially refunded; manual review required',
        retryable: false,
      }
    }
    if (payment.status === 'authorized') {
      const voided = await voidMoyasarPayment(input.paymentId)
      return { status: 'succeeded', refundId: voided.id }
    }
    if (!isMoyasarRefundable(payment.status)) {
      return {
        status: 'failed',
        message: `Moyasar payment is ${payment.status}, not refundable`,
        retryable: false,
      }
    }
    if (
      payment.amount !== requested ||
      payment.currency.toUpperCase() !== input.currency.toUpperCase()
    ) {
      return {
        status: 'failed',
        message: 'Moyasar payment amount/currency does not match the order',
        retryable: false,
      }
    }

    const remaining = payment.amount - (payment.refunded ?? 0)
    const updated = await refundMoyasarPayment(
      input.paymentId,
      remaining === requested ? undefined : requested
    )
    return (updated.refunded ?? 0) >= requested
      ? { status: 'succeeded', refundId: updated.id }
      : { status: 'pending', refundId: updated.id }
  }

  return {
    status: 'failed',
    message: `Automatic refunds are not supported for ${input.provider}`,
    retryable: false,
  }
}

async function notifyRecoveryOutcome(input: {
  orderId: string
  outcome: 'refund_pending' | 'refunded' | 'manual_review'
  amount: number
}) {
  try {
    const claimed = await Order.findOneAndUpdate(
      { _id: input.orderId, recoveryNotifiedStatus: { $ne: input.outcome } },
      {
        $set: {
          recoveryNotifiedStatus: input.outcome,
          recoveryNotifiedAt: new Date(),
        },
      },
      { new: false }
    )
    if (!claimed) return

    try {
      const order = await Order.findById(input.orderId).populate<{
        user: { _id: string; email: string; name: string }
      }>('user', '_id name email')
      if (!order?.user?.email) return

      await sendPaymentRecoveryEmail({
        order: order as unknown as OrderWithUser,
        amount: input.amount,
        outcome: input.outcome,
      })
    } catch (error) {
      // Allow a later retry to send the notification after a mail outage.
      await Order.updateOne(
        {
          _id: input.orderId,
          recoveryNotifiedStatus: input.outcome,
        },
        { $unset: { recoveryNotifiedStatus: 1, recoveryNotifiedAt: 1 } }
      )
      console.error(
        'Payment recovery customer email failed:',
        error instanceof Error ? error.name : 'Unknown error'
      )
    }
  } catch (error) {
    // A notification failure must never undo a confirmed refund or a manual
    // review state.
    console.error(
      'Payment recovery notification failed:',
      error instanceof Error ? error.name : 'Unknown error'
    )
  }
}

async function markRefunded(input: {
  orderId: string
  key: string
  paymentId: string
  refundId?: string
  amount: number
  currency: string
  provider: string
  email?: string
}) {
  const now = new Date()
  const updated = await Order.findOneAndUpdate(
    {
      _id: input.orderId,
      recoveryRefundKey: input.key,
      status: { $ne: 'refunded' },
    },
    {
      $set: {
        status: 'refunded',
        isPaid: true,
        refundedAmount: input.amount,
        refundedAt: now,
        shippingRefunded: true,
        isCancelled: true,
        cancelledAt: now,
        cancelReason: 'Fulfillment failed: stock unavailable',
        recoveryRefundStatus: 'refunded',
        recoveryRefundId: input.refundId ?? '',
        recoveryRefundError: '',
        recoveryRefundResolvedAt: now,
        paymentResult: {
          id: input.paymentId,
          status: 'refunded',
          email_address: input.email ?? '',
          pricePaid: input.amount.toFixed(2),
        },
      },
      $push: {
        refundHistory: {
          amount: input.amount,
          provider: input.provider,
          refundedAt: now,
          reason: 'Fulfillment failed: stock unavailable',
          reference: input.refundId ?? '',
        },
        statusHistory: {
          status: 'refunded',
          at: now,
          note: 'Automatic refund completed because the order could not be fulfilled',
        },
      },
    },
    { new: true }
  )

  if (updated) {
    await notifyRecoveryOutcome({
      orderId: input.orderId,
      outcome: 'refunded',
      amount: input.amount,
    })
    return { outcome: 'refunded' as const, message: 'Refund completed' }
  }

  const current = await Order.findById(input.orderId)
  if (current?.recoveryRefundStatus === 'refunded')
    return { outcome: 'already_refunded' as const, message: 'Refund already completed' }
  return {
    outcome: 'in_progress' as const,
    message: 'Refund state changed while completing',
  }
}

async function markManualReview(input: {
  orderId: string
  key?: string
  reason: string
  amount: number
  provider: string
}) {
  const now = new Date()
  const updated = await Order.updateOne(
    {
      _id: input.orderId,
      ...(input.key ? { recoveryRefundKey: input.key } : {}),
      status: { $nin: ['refunded', 'manual_review'] },
      recoveryRefundStatus: { $ne: 'refunded' },
    },
    {
      $set: {
        status: 'manual_review',
        isPaid: true,
        recoveryRefundStatus: 'manual_review',
        recoveryRefundError: input.reason.slice(0, 1000),
        recoveryRefundResolvedAt: now,
      },
      $push: {
        statusHistory: {
          status: 'manual_review',
          at: now,
          note: `Automatic refund needs manual review: ${input.reason}`.slice(
            0,
            500
          ),
        },
      },
    }
  )

  if (updated.matchedCount === 0) {
    const current = await Order.findById(input.orderId)
    if (
      current?.status === 'refunded' ||
      current?.recoveryRefundStatus === 'refunded'
    )
      return {
        outcome: 'already_refunded' as const,
        message: 'Refund already completed',
      }
    return {
      outcome: 'in_progress' as const,
      message: 'Refund state changed before manual review',
    }
  }

  await notifyRecoveryOutcome({
    orderId: input.orderId,
    outcome: 'manual_review',
    amount: input.amount,
  })
  return {
    outcome: 'manual_review' as const,
    message: 'Refund needs manual review',
  }
}

async function markPending(input: {
  orderId: string
  key: string
  reason: string
  amount: number
  refundId?: string
}) {
  const updated = await Order.updateOne(
    {
      _id: input.orderId,
      recoveryRefundKey: input.key,
      status: { $ne: 'refunded' },
      recoveryRefundStatus: { $ne: 'refunded' },
    },
    {
      $set: {
        status: 'refund_pending',
        recoveryRefundStatus: 'pending',
        recoveryRefundId: input.refundId ?? '',
        recoveryRefundError: input.reason.slice(0, 1000),
        recoveryRefundLastAttemptAt: new Date(),
      },
    }
  )

  if (updated.matchedCount === 0) {
    const current = await Order.findById(input.orderId)
    if (
      current?.status === 'refunded' ||
      current?.recoveryRefundStatus === 'refunded'
    )
      return {
        outcome: 'already_refunded' as const,
        message: 'Refund already completed',
      }
    return {
      outcome: 'in_progress' as const,
      message: 'Refund state changed before it could be marked pending',
    }
  }

  await notifyRecoveryOutcome({
    orderId: input.orderId,
    outcome: 'refund_pending',
    amount: input.amount,
  })
  return {
    outcome: 'retry' as const,
    message: 'Refund is retryable',
  }
}

/**
 * Called when a payment was captured but fulfillment could not complete.
 * The order-level claim and the provider idempotency key make repeated
 * webhooks safe: only one caller can process a given order/payment pair.
 */
export async function recoverCapturedPayment(input: {
  orderId: string
  provider: string
  paymentId: string
  amountPaid: number
  currency: string
  email?: string
  reason?: string
}): Promise<RecoveryResult> {
  await connectToDatabase()

  const key = recoveryRefundKey(input.orderId, input.paymentId)
  const now = new Date()
  const staleBefore = new Date(now.getTime() - RECOVERY_STALE_PROCESSING_MS)
  const amount = round2(input.amountPaid)
  const currency = input.currency.toUpperCase()

  const order = await Order.findById(input.orderId)
  if (!order) {
    return { outcome: 'manual_review', message: 'Order not found' }
  }
  if (
    order.status === 'refunded' ||
    order.recoveryRefundStatus === 'refunded' ||
    round2(order.refundedAmount ?? 0) >= round2(order.totalPrice) - 0.01
  ) {
    return { outcome: 'already_refunded', message: 'Refund already completed' }
  }
  if (
    order.status === 'manual_review' ||
    order.recoveryRefundStatus === 'manual_review'
  ) {
    return { outcome: 'manual_review', message: 'Refund already needs manual review' }
  }
  if (order.recoveryRefundKey && order.recoveryRefundKey !== key) {
    return markManualReview({
      orderId: input.orderId,
      key: order.recoveryRefundKey,
      reason: 'Another recovery key is already attached to this order',
      amount,
      provider: input.provider,
    })
  }

  if (!canClaimRecovery(order, key, now)) {
    if ((order.recoveryRefundAttempts ?? 0) >= RECOVERY_MAX_ATTEMPTS) {
      return markManualReview({
        orderId: input.orderId,
        key,
        reason: 'Refund attempt limit reached',
        amount,
        provider: input.provider,
      })
    }
    return {
      outcome: 'in_progress',
      message: 'Refund is already being processed',
    }
  }

  const claimed = await Order.findOneAndUpdate(
    {
      _id: input.orderId,
      status: { $nin: ['refunded', 'manual_review'] },
      $and: [
        {
          $or: [
            { recoveryRefundKey: { $exists: false } },
            {
              recoveryRefundKey: key,
              recoveryRefundStatus: { $in: ['pending', 'processing'] },
            },
          ],
        },
        {
          $or: [
            { recoveryRefundAttempts: { $exists: false } },
            { recoveryRefundAttempts: { $lt: RECOVERY_MAX_ATTEMPTS } },
          ],
        },
        {
          $or: [
            { recoveryRefundStatus: { $ne: 'processing' } },
            { recoveryRefundLastAttemptAt: { $lt: staleBefore } },
          ],
        },
      ],
    },
    {
      $set: {
        status: 'refund_pending',
        isPaid: true,
        paidAt: order.paidAt ?? now,
        paymentResult: {
          id: input.paymentId,
          status: 'captured',
          email_address: input.email ?? order.paymentResult?.email_address ?? '',
          pricePaid: amount.toFixed(2),
        },
        recoveryRefundKey: key,
        recoveryRefundStatus: 'processing',
        recoveryRefundProvider: input.provider,
        recoveryRefundPaymentId: input.paymentId,
        recoveryRefundAmount: amount,
        recoveryRefundCurrency: currency,
        recoveryRefundLastAttemptAt: now,
        recoveryRefundError: '',
      },
      $inc: { recoveryRefundAttempts: 1 },
      $push: {
        statusHistory: {
          status: 'refund_pending',
          at: now,
          note:
            input.reason ??
            'Payment captured but fulfillment failed; starting automatic refund',
        },
      },
    },
    { new: true }
  )

  if (!claimed) {
    const current = await Order.findById(input.orderId)
    if (!current)
      return { outcome: 'manual_review', message: 'Order not found' }
    if (
      current.status === 'refunded' ||
      current.recoveryRefundStatus === 'refunded'
    )
      return { outcome: 'already_refunded', message: 'Refund already completed' }
    if (
      current.status === 'manual_review' ||
      current.recoveryRefundStatus === 'manual_review'
    )
      return { outcome: 'manual_review', message: 'Refund needs manual review' }
    if ((current.recoveryRefundAttempts ?? 0) >= RECOVERY_MAX_ATTEMPTS) {
      return markManualReview({
        orderId: input.orderId,
        key: current.recoveryRefundKey ?? key,
        reason: 'Refund attempt limit reached',
        amount,
        provider: input.provider,
      })
    }
    return {
      outcome: 'in_progress',
      message: 'Refund is already being processed',
    }
  }

  const attempts = claimed.recoveryRefundAttempts ?? 1
  const recorded = await beginPaymentEvent({
    provider: normalizedProvider(input.provider),
    eventId: key,
    type: 'recovery.refund',
    orderId: input.orderId,
  })
  const paymentEventId = recorded.event ? String(recorded.event._id) : ''

  let result: ProviderRefundResult
  try {
    result = await refundWithProvider({
      provider: input.provider,
      orderId: input.orderId,
      paymentId: input.paymentId,
      amount,
      currency,
      key,
    })
  } catch (error) {
    result = {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Refund request failed',
      retryable: isRetryableRecoveryError(error),
    }
  }

  if (result.status === 'succeeded') {
    if (paymentEventId)
      await finishPaymentEvent(paymentEventId, 'processed', 'Refund completed')
    return markRefunded({
      orderId: input.orderId,
      key,
      paymentId: input.paymentId,
      refundId: result.refundId,
      amount,
      currency,
      provider: input.provider,
      email: input.email,
    })
  }

  if (result.status === 'pending') {
    if (paymentEventId)
      await finishPaymentEvent(paymentEventId, 'failed', 'Refund pending at provider')
    return markPending({
      orderId: input.orderId,
      key,
      reason: result.message ?? 'Refund pending at provider',
      amount,
      refundId: result.refundId,
    })
  }

  const retryable = result.retryable ?? false
  if (paymentEventId)
    await finishPaymentEvent(
      paymentEventId,
      retryable ? 'failed' : 'processed',
      result.message ?? 'Refund failed'
    )

  const decision = recoveryFailureOutcome(retryable, attempts)
  if (decision === 'manual_review') {
    return markManualReview({
      orderId: input.orderId,
      key,
      reason: result.message ?? 'Refund failed',
      amount,
      provider: input.provider,
    })
  }

  return markPending({
    orderId: input.orderId,
    key,
    reason: result.message ?? 'Refund request failed',
    amount,
    refundId: result.refundId,
  })
}

/** Retry refunds that are still pending, e.g. a gateway outage or a pending
 * provider refund. Called by the authenticated cron route. */
export async function retryPendingPaymentRecoveries(limit = 20) {
  await connectToDatabase()
  const cutoff = new Date(Date.now() - RETRY_DELAY_MS)
  const orders = await Order.find({
    status: 'refund_pending',
    recoveryRefundStatus: { $in: ['pending', 'processing'] },
    recoveryRefundLastAttemptAt: { $lt: cutoff },
  })
    .limit(limit)
    .lean()

  const results: Array<{ orderId: string; outcome: RecoveryOutcome; message: string }> =
    []
  for (const order of orders) {
    const paymentId =
      order.recoveryRefundPaymentId ?? order.paymentResult?.id ?? ''
    if (!paymentId) {
      const result = await markManualReview({
        orderId: String(order._id),
        key: order.recoveryRefundKey,
        reason: 'Missing payment reference',
        amount: order.recoveryRefundAmount ?? order.totalPrice,
        provider: order.recoveryRefundProvider ?? order.paymentMethod,
      })
      results.push({
        orderId: String(order._id),
        outcome: result.outcome,
        message: result.message,
      })
      continue
    }

    try {
      const result = await recoverCapturedPayment({
        orderId: String(order._id),
        provider: order.recoveryRefundProvider ?? order.paymentMethod,
        paymentId,
        amountPaid: order.recoveryRefundAmount ?? order.totalPrice,
        currency: order.recoveryRefundCurrency ?? order.currency ?? 'SAR',
        email: order.paymentResult?.email_address ?? '',
        reason: 'Retrying automatic refund after fulfillment failed',
      })
      results.push({
        orderId: String(order._id),
        outcome: result.outcome,
        message: result.message,
      })
    } catch (error) {
      results.push({
        orderId: String(order._id),
        outcome: 'retry',
        message:
          error instanceof Error ? error.message : 'Recovery retry failed',
      })
    }
  }
  return results
}
