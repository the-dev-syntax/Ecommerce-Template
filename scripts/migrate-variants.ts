import mongoose from 'mongoose'

import Product from '../lib/db/models/product.model'
import { generateId, round2 } from '../lib/utils'

/**
 * Migrate existing products to a default variant without losing price or stock.
 * Admin can add more variants afterwards.
 *
 *   npm run migrate:variants
 */
async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing')

  await mongoose.connect(uri)
  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1'

  const products = await Product.find({
    $or: [
      { variants: { $exists: false } },
      { variants: { $size: 0 } },
    ],
  }).lean()

  for (const product of products) {
    const variant = {
      id: generateId(),
      sku: product.slug,
      size: product.sizes?.[0] ?? '',
      color: product.colors?.[0] ?? '',
      price: round2(product.price),
      listPrice: round2(product.listPrice ?? 0),
      countInStock: Math.max(0, Math.floor(product.countInStock ?? 0)),
      image: product.images?.[0] ?? '',
      barcode: '',
      weight: 0,
      isDefault: true,
    }

    if (!dryRun) {
      await Product.updateOne(
        { _id: product._id },
        { $set: { variants: [variant] } }
      )
    }
  }

  console.log(
    `${dryRun ? 'Would migrate' : 'Migrated'} ${products.length} products to a default variant.`
  )
}

main()
  .catch((error) => {
    console.error(
      'Variant migration failed:',
      error instanceof Error ? error.message : error
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
