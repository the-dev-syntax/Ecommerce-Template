import mongoose from 'mongoose'

import Order from '../lib/db/models/order.model'
import { round2 } from '../lib/utils'

/**
 * Backfill tax snapshots on orders created before VAT-inclusive pricing.
 *
 * Legacy orders were VAT-exclusive: itemsPrice + shipping + taxPrice = total.
 * They have no taxInclusive/taxRate/item tax fields, so Mongoose's schema
 * default would otherwise treat their gross total as VAT-inclusive and produce
 * an invoice that does not add up.
 *
 * Run once after deploying P0-22/P0-23:
 *   npm run migrate:tax
 */
type LegacyItem = {
  price: number
  quantity: number
  taxCategory?: 'S' | 'Z' | 'E' | 'O'
  netPrice?: number
  vatPercent?: number
  vatAmount?: number
  [key: string]: unknown
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing')

  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1'
  await mongoose.connect(uri)

  const collection = Order.collection
  const cursor = collection.find({ taxInclusive: { $exists: false } })
  let migrated = 0

  for await (const doc of cursor) {
    const taxRate = 0.15
    const items = ((doc.items ?? []) as LegacyItem[]).map((item) => {
      const taxCategory = item.taxCategory ?? 'S'
      const netPrice = round2(item.netPrice ?? item.price)
      const vatPercent =
        item.vatPercent ?? (taxCategory === 'S' ? round2(taxRate * 100) : 0)
      const vatAmount =
        item.vatAmount ??
        (taxCategory === 'S'
          ? round2(netPrice * item.quantity * taxRate)
          : 0)

      return { ...item, taxCategory, netPrice, vatPercent, vatAmount }
    })

    // Reconcile line VAT with the order's stored tax so the future invoice
    // total (net + VAT + shipping) matches the amount that was actually paid.
    const storedTax = round2(doc.taxPrice ?? 0)
    const computedTax = round2(
      items.reduce((sum, item) => sum + item.vatAmount!, 0)
    )
    const difference = round2(storedTax - computedTax)
    if (difference !== 0) {
      const index = items.findIndex(
        (item) => item.taxCategory === 'S' && item.vatAmount! + difference >= 0
      )
      if (index >= 0) {
        items[index].vatAmount = round2(items[index].vatAmount! + difference)
      }
    }

    if (!dryRun) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { items, taxInclusive: false, taxRate } }
      )
    }
    migrated += 1
  }

  console.log(
    migrated === 0
      ? 'No legacy orders need tax snapshots.'
      : `${dryRun ? 'Would migrate' : 'Migrated'} ${migrated} legacy orders to VAT-exclusive tax snapshots.`
  )
}

main()
  .catch((error) => {
    console.error(
      'Tax snapshot migration failed:',
      error instanceof Error ? error.message : error
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
