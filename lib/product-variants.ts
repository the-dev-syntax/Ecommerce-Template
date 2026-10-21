import type { IProductInput, IProductVariant } from '@/types'
import { generateId, round2 } from '@/lib/utils'

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

/**
 * Keep the legacy product fields (price, sizes, colors, countInStock) in sync
 * with the variant list. Every product has at least one default variant.
 */
export function normalizeProductVariants(
  product: IProductInput
): IProductInput {
  const variants: IProductVariant[] = (product.variants ?? []).map(
    (variant, index) => ({
      id: variant.id || generateId(),
      sku: variant.sku || `${product.slug}-${index + 1}`,
      size: variant.size ?? '',
      color: variant.color ?? '',
      price: round2(variant.price),
      listPrice: round2(variant.listPrice ?? 0),
      countInStock: Math.max(0, Math.floor(variant.countInStock)),
      image: variant.image || product.images?.[index] || product.images?.[0] || '',
      barcode: variant.barcode ?? '',
      weight: variant.weight ?? 0,
      isDefault: variant.isDefault,
    })
  )

  if (variants.length === 0) {
    variants.push({
      id: generateId(),
      sku: product.slug,
      size: product.sizes?.[0] ?? '',
      color: product.colors?.[0] ?? '',
      price: round2(product.price),
      listPrice: round2(product.listPrice ?? 0),
      countInStock: Math.max(0, Math.floor(product.countInStock)),
      image: product.images?.[0] ?? '',
      barcode: '',
      weight: 0,
      isDefault: true,
    })
  }

  let defaultIndex = variants.findIndex((variant) => variant.isDefault)
  if (defaultIndex < 0) defaultIndex = 0
  variants.forEach((variant, index) => {
    variant.isDefault = index === defaultIndex
  })

  return {
    ...product,
    variants,
    sizes: unique(variants.map((variant) => variant.size)),
    colors: unique(variants.map((variant) => variant.color)),
    countInStock: variants.reduce(
      (total, variant) => total + variant.countInStock,
      0
    ),
  }
}
