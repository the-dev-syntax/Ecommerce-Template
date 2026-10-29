import { NextRequest, NextResponse } from 'next/server'

import Product from '@/lib/db/models/product.model'
import { connectToDatabase } from '@/lib/db'
import { getSetting } from '@/lib/actions/setting.actions'

const MAX_IDS = 50
const MAX_CATEGORIES = 20
const MAX_CATEGORY_LENGTH = 100
const OBJECT_ID_RE = /^[a-f\d]{24}$/i

/** Trim, de-duplicate and cap a comma-separated query parameter. */
function splitList(value: string | null, max: number) {
  if (!value) return []
  return [
    ...new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, max)
    ),
  ]
}

// Only the fields the product card renders. Keeps SKUs and tax metadata out of
// a public, unauthenticated response.
const CARD_PROJECTION = {
  name: 1,
  slug: 1,
  category: 1,
  images: 1,
  brand: 1,
  price: 1,
  listPrice: 1,
  tags: 1,
  avgRating: 1,
  numReviews: 1,
  countInStock: 1,
  returnPolicy: 1,
  sizes: 1,
  colors: 1,
  variants: 1,
}

function toCard(product: Record<string, unknown>) {
  const variants = Array.isArray(product.variants) ? product.variants : []
  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    images: product.images ?? [],
    brand: product.brand,
    price: product.price,
    listPrice: product.listPrice,
    tags: product.tags ?? [],
    avgRating: product.avgRating ?? 0,
    numReviews: product.numReviews ?? 0,
    countInStock: product.countInStock ?? 0,
    returnPolicy: product.returnPolicy,
    sizes: product.sizes ?? [],
    colors: product.colors ?? [],
    variants: variants.map((variant) => {
      const entry = variant as Record<string, unknown>
      return {
        id: entry.id,
        size: entry.size,
        color: entry.color,
        price: entry.price,
        listPrice: entry.listPrice,
        countInStock: entry.countInStock ?? 0,
        image: entry.image,
        weight: entry.weight ?? 0,
      }
    }),
  }
}

export async function GET(request: NextRequest) {
  const { features } = await getSetting()
  if (!features.browsingHistory) return NextResponse.json([])

  const params = request.nextUrl.searchParams
  const listType = params.get('type') === 'related' ? 'related' : 'history'

  const productIds = splitList(params.get('ids'), MAX_IDS).filter((id) =>
    OBJECT_ID_RE.test(id)
  )
  const categories = splitList(
    params.get('categories'),
    MAX_CATEGORIES
  ).filter((category) => category.length <= MAX_CATEGORY_LENGTH)

  if (listType === 'history' ? productIds.length === 0 : categories.length === 0)
    return NextResponse.json([])

  const filter =
    listType === 'history'
      ? { _id: { $in: productIds }, isPublished: true }
      : {
          category: { $in: categories },
          _id: { $nin: productIds },
          isPublished: true,
        }

  await connectToDatabase()

  const products = await Product.find(filter)
    .select(CARD_PROJECTION)
    .limit(MAX_IDS)
    .lean()

  const cards = products.map((product) =>
    toCard(product as unknown as Record<string, unknown>)
  )

  if (listType === 'history') {
    // Keep the order in which the visitor viewed the products.
    const order = new Map(
      productIds.map((id, index) => [id, index] as const)
    )
    cards.sort(
      (a, b) =>
        (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER)
    )
  }

  return NextResponse.json(cards)
}
