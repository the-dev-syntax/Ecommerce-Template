/**
 * Units still to be returned to stock for an order line.
 *
 * Cancellation and dashboard-refund restocking both use this rule so the same
 * line can never be restocked twice. `restockedQuantity` is written under an
 * atomic claim by both pipelines.
 */
export function remainingRestockQuantity(item: {
  quantity: number
  restockedQuantity?: number | null
}): number {
  return Math.max(0, item.quantity - (item.restockedQuantity ?? 0))
}
