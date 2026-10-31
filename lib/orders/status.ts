import type { IOrder } from '@/lib/db/models/order.model'

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'returned',
  'refund_pending',
  'manual_review',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export function deriveOrderStatus(order: IOrder): OrderStatus {
  if (order.status) {
    if (order.status === 'pending_payment') {
      if (order.isCancelled) return 'cancelled'
      if (order.isPaid) return order.isDelivered ? 'delivered' : 'paid'
    }
    if (
      (order.status === 'paid' || order.status === 'shipped') &&
      order.isDelivered
    )
      return 'delivered'
    return order.status
  }
  if (order.isCancelled) return 'cancelled'
  if (order.isDelivered) return 'delivered'
  if (order.isPaid) return 'paid'
  return 'pending_payment'
}

/** True when the whole order has been refunded. */
export function isFullyRefunded(order: {
  status?: string | null
  refundedAmount?: number | null
  totalPrice?: number | null
}): boolean {
  if (order.status === 'refunded') return true
  const total = order.totalPrice ?? 0
  return total > 0 && (order.refundedAmount ?? 0) >= total - 0.01
}

export function statusHistoryEntry(
  status: OrderStatus,
  note?: string
) {
  return { status, at: new Date(), note }
}
