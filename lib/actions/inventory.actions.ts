'use server'

import { z } from 'zod'

import { auth } from '@/auth'
import { requireAdmin } from '@/lib/access'
import { connectToDatabase } from '@/lib/db'
import InventoryAdjustment from '@/lib/db/models/inventory-adjustment.model'
import Product from '@/lib/db/models/product.model'
import { recordInventoryAdjustment } from '@/lib/inventory/adjustments'
import { formatError } from '@/lib/utils'
import { revalidateAllLocales } from '@/lib/utils-serverOnly'

const DEFAULT_LOW_STOCK_THRESHOLD = 5

const AdjustInventorySchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().max(100).optional(),
  quantityChange: z.coerce.number().int().refine((value) => value !== 0, {
    message: 'Quantity change must not be zero',
  }),
  reason: z.string().min(1, 'Reason is required').max(100),
  note: z.string().max(500).optional(),
})

function variantLabel(variant: {
  size?: string
  color?: string
  sku?: string
}) {
  return (
    [variant.size, variant.color].filter(Boolean).join(' / ') ||
    variant.sku ||
    ''
  )
}

export async function getInventoryOverview() {
  requireAdmin(await auth())
  await connectToDatabase()

  const [products, adjustments] = await Promise.all([
    Product.find(
      {},
      {
        name: 1,
        slug: 1,
        countInStock: 1,
        lowStockThreshold: 1,
        variants: 1,
      }
    )
      .sort({ countInStock: 1, name: 1 })
      .lean(),
    InventoryAdjustment.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ])

  const lowStock = products.flatMap((product) => {
    const threshold = product.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD
    const variants = product.variants ?? []
    if (variants.length === 0) {
      return product.countInStock <= threshold
        ? [
            {
              productId: String(product._id),
              productName: product.name,
              slug: product.slug,
              variantId: '',
              sku: '',
              variantLabel: '',
              stock: product.countInStock,
              threshold,
            },
          ]
        : []
    }
    return variants
      .filter((variant) => variant.countInStock <= threshold)
      .map((variant) => ({
        productId: String(product._id),
        productName: product.name,
        slug: product.slug,
        variantId: variant.id,
        sku: variant.sku,
        variantLabel: variantLabel(variant),
        stock: variant.countInStock,
        threshold,
      }))
  })

  lowStock.sort((a, b) => a.stock - b.stock || a.productName.localeCompare(b.productName))

  return {
    products: products.map((product) => ({
      _id: String(product._id),
      name: product.name,
      countInStock: product.countInStock,
      variants: (product.variants ?? []).map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        label: variantLabel(variant),
        countInStock: variant.countInStock,
      })),
    })),
    lowStock,
    adjustments: JSON.parse(JSON.stringify(adjustments)),
  }
}

export async function getLowStockCount() {
  requireAdmin(await auth())
  await connectToDatabase()
  const result = await Product.aggregate<{ count: number }>([
    {
      $project: {
        lowStockThreshold: { $ifNull: ['$lowStockThreshold', DEFAULT_LOW_STOCK_THRESHOLD] },
        lowVariants: {
          $size: {
            $filter: {
              input: { $ifNull: ['$variants', []] },
              as: 'variant',
              cond: {
                $lte: [
                  '$$variant.countInStock',
                  { $ifNull: ['$lowStockThreshold', DEFAULT_LOW_STOCK_THRESHOLD] },
                ],
              },
            },
          },
        },
        productLow: {
          $lte: [
            '$countInStock',
            { $ifNull: ['$lowStockThreshold', DEFAULT_LOW_STOCK_THRESHOLD] },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        count: {
          $sum: {
            $cond: [
              { $gt: ['$lowVariants', 0] },
              '$lowVariants',
              { $cond: ['$productLow', 1, 0] },
            ],
          },
        },
      },
    },
  ])
  return result[0]?.count ?? 0
}

export async function adjustInventory(input: z.infer<typeof AdjustInventorySchema>) {
  try {
    const session = await auth()
    requireAdmin(session)
    const parsed = AdjustInventorySchema.parse(input)
    await connectToDatabase()

    const product = await Product.findById(parsed.productId)
    if (!product) throw new Error('Product not found')

    const variant = parsed.variantId
      ? product.variants?.find((entry) => entry.id === parsed.variantId)
      : undefined
    if (parsed.variantId && !variant) throw new Error('Variant not found')
    if (!parsed.variantId && (product.variants?.length ?? 0) > 0)
      throw new Error('Select a variant to adjust this product')

    const previousStock = variant ? variant.countInStock : product.countInStock
    const newStock = previousStock + parsed.quantityChange
    if (!Number.isInteger(newStock) || newStock < 0)
      throw new Error('Stock cannot be negative')

    const result = variant
      ? await Product.updateOne(
          {
            _id: product._id,
            variants: {
              $elemMatch: {
                id: variant.id,
                countInStock: previousStock,
              },
            },
            ...(parsed.quantityChange < 0
              ? { countInStock: { $gte: -parsed.quantityChange } }
              : {}),
          },
          {
            $inc: {
              'variants.$.countInStock': parsed.quantityChange,
              countInStock: parsed.quantityChange,
            },
          }
        )
      : await Product.updateOne(
          { _id: product._id, countInStock: previousStock },
          { $inc: { countInStock: parsed.quantityChange } }
        )

    if (result.modifiedCount !== 1)
      throw new Error('Stock changed while saving. Reload and try again.')

    await recordInventoryAdjustment({
      product: String(product._id),
      productName: product.name,
      variantId: variant?.id,
      sku: variant?.sku,
      variantLabel: variant ? variantLabel(variant) : '',
      previousStock,
      newStock,
      quantityChange: parsed.quantityChange,
      source: 'manual',
      reason: parsed.reason,
      note: parsed.note,
      actorId: session?.user?.id,
      actorEmail: session?.user?.email ?? '',
    })

    await revalidateAllLocales('/admin/inventory')
    await revalidateAllLocales('/admin/products')
    await revalidateAllLocales(`/admin/products/${product._id}`)

    return {
      success: true,
      message: 'Inventory adjusted successfully',
      data: { previousStock, newStock },
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}
