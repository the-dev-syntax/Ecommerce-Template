import StockReservation, {
  type IStockReservationItem,
} from '@/lib/db/models/stock-reservation.model'
import Product from '@/lib/db/models/product.model'
import { connectToDatabase } from '@/lib/db'

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
  direction: 1 | -1
) {
  return Product.updateOne(
    item.variantId
      ? { _id: item.product, 'variants.id': item.variantId }
      : { _id: item.product },
    { $inc: stockIncrement(item, direction) }
  )
}

/** Atomically hold stock for a new order. */
export async function reserveStockForOrder(order: {
  _id: string
  items: { product: string; variantId?: string; quantity: number }[]
}) {
  await connectToDatabase()
  const existing = await StockReservation.findOne({
    orderId: String(order._id),
  }).lean()
  if (existing) return existing

  const items: IStockReservationItem[] = order.items.map((item) => ({
    product: String(item.product),
    variantId: item.variantId ?? '',
    quantity: item.quantity,
  }))
  const reserved: IStockReservationItem[] = []

  try {
    for (const item of items) {
      const result = await Product.updateOne(
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
        { $inc: stockIncrement(item, -1) }
      )
      if (result.modifiedCount !== 1) {
        throw new Error('Not enough stock to reserve this order')
      }
      reserved.push(item)
    }

    return await StockReservation.create({
      orderId: String(order._id),
      items,
      status: 'held',
      expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
    })
  } catch (error) {
    for (const item of reserved) {
      await changeStock(item, 1)
    }
    throw error
  }
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

/** Release an unpaid/cancelled order's held stock. */
export async function releaseStockReservation(
  orderId: string,
  restock = true
) {
  const reservation = await StockReservation.findOne({
    orderId: String(orderId),
    status: 'held',
  }).lean()
  if (!reservation) return false

  if (restock) {
    for (const item of reservation.items) {
      await changeStock(item, 1)
    }
  }
  await StockReservation.updateOne(
    { _id: reservation._id },
    { $set: { status: 'released' } }
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

  for (const reservation of expired) {
    const claimed = await StockReservation.findOneAndUpdate(
      { _id: reservation._id, status: 'held' },
      { $set: { status: 'released' } },
      { new: true }
    )
    if (!claimed) continue
    for (const item of reservation.items) {
      await changeStock(item, 1)
    }
  }

  return expired.length
}
