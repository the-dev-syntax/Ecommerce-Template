import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeProductVariants } from '../lib/product-variants'
import type { IProductInput } from '../types'

const base = {
  name: 'Variant product',
  slug: 'variant-product',
  category: 'Test',
  images: ['/images/p1.jpg'],
  brand: 'EV',
  description: 'Test',
  isPublished: true,
  price: 115,
  listPrice: 120,
  countInStock: 5,
  tags: [],
  sizes: ['M'],
  colors: ['Black'],
  avgRating: 0,
  numReviews: 0,
  ratingDistribution: [],
  reviews: [],
  numSales: 0,
} as unknown as IProductInput

describe('normalizeProductVariants', () => {
  it('creates a default variant when none exist', () => {
    const product = normalizeProductVariants(base)
    assert.equal(product.variants?.length, 1)
    assert.equal(product.variants?.[0].countInStock, 5)
    assert.equal(product.variants?.[0].price, 115)
    assert.equal(product.variants?.[0].isDefault, true)
    assert.deepEqual(product.sizes, ['M'])
    assert.deepEqual(product.colors, ['Black'])
  })

  it('aggregates stock and derives sizes/colors from variants', () => {
    const product = normalizeProductVariants({
      ...base,
      countInStock: 0,
      variants: [
        {
          id: 'v1',
          sku: 'SKU-1',
          size: 'S',
          color: 'Red',
          price: 10,
          listPrice: 12,
          countInStock: 3,
          image: '',
          barcode: '',
          weight: 0,
          isDefault: true,
        },
        {
          id: 'v2',
          sku: 'SKU-2',
          size: 'M',
          color: 'Blue',
          price: 11,
          listPrice: 13,
          countInStock: 4,
          image: '',
          barcode: '',
          weight: 0,
          isDefault: false,
        },
      ],
    })

    assert.equal(product.countInStock, 7)
    assert.deepEqual(product.sizes, ['S', 'M'])
    assert.deepEqual(product.colors, ['Red', 'Blue'])
    assert.equal(product.variants?.[0].isDefault, true)
    assert.equal(product.variants?.[1].isDefault, false)
  })
})
