import mongoose from 'mongoose'

import Invoice from '../lib/db/models/invoice.model'
import Order from '../lib/db/models/order.model'
import Product from '../lib/db/models/product.model'

/**
 * Backfill the item-level return/refund fields and rebuild invoice indexes.
 *
 * Run once after deploying the return/refund feature:
 *   npm run migrate:returns
 *
 * Existing orders are snapshotted from the current product policy. Orders that
 * were already refunded before this feature are marked fully refunded per item
 * so a second automatic return cannot over-refund them.
 */
async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing')

  await mongoose.connect(uri)
  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1'

  const productFilter = { returnPolicy: { $exists: false } }
  const productsToUpdate = await Product.countDocuments(productFilter)
  if (!dryRun) {
    await Product.updateMany(productFilter, {
      $set: { returnPolicy: 'return_and_refund' },
    })
  }
  console.log(
    `${dryRun ? 'Would update' : 'Updated'} ${productsToUpdate} products with the default return policy.`
  )

  const cursor = Order.collection.find({
    $or: [
      { 'items.returnPolicy': { $exists: false } },
      { 'items.refundedQuantity': { $exists: false } },
      { 'items.restockedQuantity': { $exists: false } },
      { shippingRefunded: { $exists: false } },
    ],
  })

  let migratedOrders = 0
  for await (const doc of cursor) {
    const productIds = ((doc.items ?? []) as { product: string }[]).map(
      (item) => item.product
    )
    const products = await Product.find(
      { _id: { $in: productIds } },
      'returnPolicy'
    ).lean()
    const policyById = new Map(
      products.map((product) => [
        String(product._id),
        product.returnPolicy ?? 'return_and_refund',
      ])
    )

    const legacyRefund = (doc.refundedAmount ?? 0) > 0
    const items = (
      (doc.items ?? []) as {
        product: string
        quantity: number
        returnPolicy?: string
        refundedQuantity?: number
        restockedQuantity?: number
      }[]
    ).map((item) => ({
      ...item,
      returnPolicy:
        item.returnPolicy ??
        policyById.get(String(item.product)) ??
        'return_and_refund',
      refundedQuantity:
        item.refundedQuantity ?? (legacyRefund ? item.quantity : 0),
      restockedQuantity:
        item.restockedQuantity ?? (legacyRefund ? item.quantity : 0),
    }))

    if (!dryRun) {
      await Order.collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            items,
            shippingRefunded: doc.shippingRefunded ?? legacyRefund,
          },
        }
      )
    }
    migratedOrders += 1
  }

  console.log(
    `${dryRun ? 'Would migrate' : 'Migrated'} ${migratedOrders} orders to item-level return snapshots.`
  )

  // Give legacy credit notes a stable event id before the new unique index is
  // created, so the sparse index accepts them.
  const legacyCreditNotes = await Invoice.collection
    .find({
      type: 'credit_note',
      creditNoteEventId: { $exists: false },
    })
    .toArray()
  for (const note of legacyCreditNotes) {
    if (!dryRun) {
      await Invoice.collection.updateOne(
        { _id: note._id },
        {
          $set: {
            creditNoteEventId: `legacy:${String(note.orderId)}`,
            creditNoteReason: 'legacy',
          },
        }
      )
    }
  }
  console.log(
    `${dryRun ? 'Would update' : 'Updated'} ${legacyCreditNotes.length} legacy credit notes.`
  )

  if (!dryRun) {
    const indexes = await Invoice.collection.indexes()
    for (const index of indexes) {
      if (
        index.name &&
        index.key?.orderId === 1 &&
        index.key?.type === 1 &&
        index.name !== 'orderid_1_type_1_invoice_unique'
      ) {
        await Invoice.collection.dropIndex(index.name)
        console.log(`Dropped the old invoice index ${index.name}.`)
      }
    }

    await Invoice.collection.createIndex(
      { orderId: 1, type: 1 },
      {
        unique: true,
        partialFilterExpression: { type: 'invoice' },
        name: 'orderid_1_type_1_invoice_unique',
      }
    )
    await Invoice.collection.createIndex(
      { creditNoteEventId: 1 },
      {
        unique: true,
        sparse: true,
        name: 'creditNoteEventId_1',
      }
    )
    console.log('Invoice indexes rebuilt for multiple credit notes per order.')
  }
}

main()
  .catch((error) => {
    console.error(
      'Return/refund migration failed:',
      error instanceof Error ? error.message : error
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
