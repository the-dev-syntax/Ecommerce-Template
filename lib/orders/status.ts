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
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export function deriveOrderStatus(order: IOrder): OrderStatus {
  if (order.status) {
    if (order.status === 'pending_payment') {
      if (order.isCancelled) return 'cancelled'
      if (order.isPaid) return order.isDelivered ? 'delivered' : 'paid'
    }
    if (order.status === 'paid' && order.isDelivered) return 'delivered'
    return order.status
  }
  if (order.isCancelled) return 'cancelled'
  if (order.isDelivered) return 'delivered'
  if (order.isPaid) return 'paid'
  return 'pending_payment'
}

export function statusHistoryEntry(
  status: OrderStatus,
  note?: string
) {
  return { status, at: new Date(), note }
}
