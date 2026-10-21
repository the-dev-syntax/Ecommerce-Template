import mongoose from 'mongoose'

import StockReservation, {
  type IStockReservation,
  type IStockReservationItem,
} from '@/lib/db/models/stock-reservation.model'
import Product from '@/lib/db/models/product.model'
import { connectToDatabase } from '@/lib/db'
import { recordInventoryAdjustment } from '@/lib/inventory/adjustments'
import type { InventoryAdjustmentSource } from '@/lib/db/models/inventory-adjustment.model'

export const RESERVATION_TTL_MS = 30 * 60 * 1000

function stockIncrement(item: IStockReservationItem, direction: 1 | -1) {
  return {
    countInStock: direction * item.quantity,
    ...(item.variantId
      ? { 'variants.$.countInStock': direction * item.quantity }
      : {}),
  }
}

async function changeStock(
  item: IStockReservationItem,
  direction: 1 | -1,
  session?: mongoose.ClientSession
) {
  const product = await Product.findOneAndUpdate(
    item.variantId
      ? { _id: item.product, 'variants.id': item.variantId }
      : { _id: item.product },
    { $inc: stockIncrement(item, direction) },
    { new: true, session }
  )
  return product
}

/** Best-effort audit after a release transaction has committed. */
async function auditRelease(
  reservation: IStockReservation,
  source: InventoryAdjustmentSource,
  reason: string
) {
  for (const item of reservation.items) {
    const product = await Product.findById(item.product)
    if (!product) continue
    const variant = item.variantId
      ? product.variants?.find((entry) => entry.id === item.variantId)
      : undefined
    const newStock = variant ? variant.countInStock : product.countInStock
    await recordInventoryAdjustment({
      product: String(product._id),
      productName: product.name,
      variantId: variant?.id,
      sku: variant?.sku,
      variantLabel: variant
        ? [variant.size, variant.color].filter(Boolean).join(' / ')
        : '',
      previousStock: newStock - item.quantity,
      newStock,
      quantityChange: item.quantity,
      source,
      reason,
      orderId: reservation.orderId,
    })
  }
}

/** Atomically hold stock for a new order. */
export async function reserveStockForOrder(order: {
  _id: string
  items: { product: string; variantId?: string; quantity: number }[]
  paymentMethod?: string
}) {
  await connectToDatabase()
  const existing = await StockReservation.findOne({
    orderId: String(order._id),
  }).lean()
  if (existing) {
    if (existing.status === 'released')
      throw new Error('Stock reservation was already released')
    return existing
  }

  const items: IStockReservationItem[] = order.items.map((item) => ({
    product: String(item.product),
    variantId: item.variantId ?? '',
    quantity: item.quantity,
  }))
  const auditEntries: {
    product: string
    productName: string
    variantId?: string
    sku?: string
    variantLabel?: string
    previousStock: number
    newStock: number
    quantityChange: number
  }[] = []

  const session = await mongoose.connection.startSession()
  let reservation: IStockReservation | null = null

  try {
    await session.withTransaction(async () => {
      // Stock decrements and the reservation document commit together, so a
      // crash cannot leave stock reserved without a record to release it.
      for (const item of items) {
        const product = await Product.findOneAndUpdate(
          item.variantId
            ? {
                _id: item.product,
                countInStock: { $gte: item.quantity },
                variants: {
                  $elemMatch: {
                    id: item.variantId,
                    countInStock: { $gte: item.quantity },
                  },
                },
              }
            : {
                _id: item.product,
                countInStock: { $gte: item.quantity },
              },
          { $inc: stockIncrement(item, -1) },
          { new: true, session }
        )
        if (!product) {
          throw new Error('Not enough stock to reserve this order')
        }

        const variant = item.variantId
          ? product.variants?.find((entry) => entry.id === item.variantId)
          : undefined
        const newStock = variant ? variant.countInStock : product.countInStock
        auditEntries.push({
          product: String(product._id),
          productName: product.name,
          variantId: variant?.id,
          sku: variant?.sku,
          variantLabel: variant
            ? [variant.size, variant.color].filter(Boolean).join(' / ')
            : '',
          previousStock: newStock + item.quantity,
          newStock,
          quantityChange: -item.quantity,
        })
      }

      const [created] = await StockReservation.create(
        [
          {
            orderId: String(order._id),
            items,
            status: 'held',
            // COD has no gateway deadline; the hold stays until the order is
            // paid, cancelled, or an admin releases it.
            expiresAt:
              order.paymentMethod === 'Cash On Delivery'
                ? undefined
                : new Date(Date.now() + RESERVATION_TTL_MS),
          },
        ],
        { session }
      )
      reservation = created
    })
  } finally {
    await session.endSession()
  }

  for (const entry of auditEntries) {
    await recordInventoryAdjustment({
      ...entry,
      source: 'order_reserved',
      reason: 'Order stock reservation',
      orderId: String(order._id),
    })
  }

  if (!reservation)
    throw new Error('Unable to create the stock reservation')
  return reservation
}

/** Mark a paid order's reservation as committed without changing stock. */
export async function commitStockReservation(orderId: string) {
  await StockReservation.updateOne(
    { orderId: String(orderId), status: 'held' },
    { $set: { status: 'committed' } }
  )
}

/** Mark a reservation released after the caller has already restocked it. */
export async function markStockReservationReleased(orderId: string) {
  await StockReservation.updateOne(
    { orderId: String(orderId), status: { $ne: 'released' } },
    { $set: { status: 'released' } }
  )
}

/**
 * Release an unpaid/cancelled order's held stock. The claim, all product
 * restocks and the final status write run in one transaction, so a crash
 * cannot leave a partially restocked reservation.
 */
export async function releaseStockReservation(
  orderId: string,
  restock = true
) {
  const session = await mongoose.connection.startSession()
  let reservation: IStockReservation | null = null
  let committed = false

  try {
    await session.withTransaction(async () => {
      reservation = await StockReservation.findOneAndUpdate(
        { orderId: String(orderId), status: 'held' },
        { $set: { status: 'releasing' } },
        { new: true, session }
      )
      const claimed = reservation
      if (!claimed) return

      if (restock) {
        for (const item of claimed.items) {
          await changeStock(item, 1, session)
        }
      }
      await StockReservation.updateOne(
        { _id: claimed._id },
        { $set: { status: 'released' } },
        { session }
      )
      committed = true
    })
  } finally {
    await session.endSession()
  }

  if (!committed || !reservation) return false
  if (restock)
    await auditRelease(
      reservation,
      'reservation_released',
      'Order cancelled or deleted'
    )
  return true
}

/** Release expired unpaid reservations. Safe to call repeatedly. */
export async function releaseExpiredReservations() {
  await connectToDatabase()
  const expired = await StockReservation.find({
    status: 'held',
    expiresAt: { $lte: new Date() },
  }).lean()

  let releasedCount = 0
  for (const candidate of expired) {
    const session = await mongoose.connection.startSession()
    let claimedReservation: IStockReservation | null = null
    let committed = false

    try {
      await session.withTransaction(async () => {
        claimedReservation = await StockReservation.findOneAndUpdate(
          { _id: candidate._id, status: 'held' },
          { $set: { status: 'releasing' } },
          { new: true, session }
        )
        const claimed = claimedReservation
        if (!claimed) return

        for (const item of claimed.items) {
          await changeStock(item, 1, session)
        }
        await StockReservation.updateOne(
          { _id: claimed._id },
          { $set: { status: 'released' } },
          { session }
        )
        committed = true
      })
    } catch (error) {
      console.error(
        `Failed to release expired reservation ${String(candidate._id)}:`,
        error
      )
    } finally {
      await session.endSession()
    }

    if (committed && claimedReservation) {
      await auditRelease(
        claimedReservation,
        'reservation_expired',
        'Stock reservation expired'
      )
      releasedCount += 1
    }
  }

  return releasedCount
}
