import InventoryAdjustment, {
  type InventoryAdjustmentSource,
} from '@/lib/db/models/inventory-adjustment.model'

export interface InventoryAdjustmentInput {
  product: string
  productName: string
  variantId?: string
  sku?: string
  variantLabel?: string
  previousStock: number
  newStock: number
  quantityChange: number
  source: InventoryAdjustmentSource
  reason?: string
  note?: string
  orderId?: string
  returnId?: string
  actorId?: string
  actorEmail?: string
}

/**
 * Best-effort audit write. A logging failure must never block an order or
 * inventory operation, but it is always surfaced in the server log.
 */
export async function recordInventoryAdjustment(
  input: InventoryAdjustmentInput
) {
  try {
    await InventoryAdjustment.create({
      ...input,
      variantId: input.variantId ?? '',
      sku: input.sku ?? '',
      variantLabel: input.variantLabel ?? '',
      reason: input.reason ?? '',
      note: input.note ?? '',
      orderId: input.orderId ?? '',
      returnId: input.returnId ?? '',
      actorId: input.actorId ?? '',
      actorEmail: input.actorEmail ?? '',
    })
  } catch (error) {
    console.error(
      'Inventory adjustment audit failed:',
      error instanceof Error ? error.message : error
    )
  }
}
