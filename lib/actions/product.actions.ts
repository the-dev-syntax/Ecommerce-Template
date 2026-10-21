'use server'
import { connectToDatabase } from '@/lib/db'
import Product, { IProduct } from '@/lib/db/models/product.model'
import Order from '@/lib/db/models/order.model'
import StockReservation from '@/lib/db/models/stock-reservation.model'
import { clampLimit, clampPage, escapeRegExp, formatError } from '../utils'
import { ProductInputSchema, ProductUpdateSchema } from '../validator'
import { normalizeProductVariants } from '../product-variants'
import { recordInventoryAdjustment } from '@/lib/inventory/adjustments'
import { IProductInput } from '@/types'
import { z } from 'zod'
import { auth } from '@/auth'
import { getSetting } from './setting.actions'
import { revalidateAllLocales } from '../utils-serverOnly'  


//* GET ALL CATEGORIES
export async function getAllCategories() {
  await connectToDatabase()
  const categories = await Product.find({ isPublished: true }).distinct('category')
  return categories
}

//* GET PRODUCTS FOR CARD
export async function getProductsForCard({
  tag,
  limit = 4,
}: {
  tag: string
  limit?: number
}) {
  await connectToDatabase()
  const products = await Product.find(
    { tags: { $in: [tag] }, isPublished: true },
    {
      name: 1,
      href: { $concat: ['/product/', '$slug'] },
      image: { $arrayElemAt: ['$images', 0] },
    }
  )
    .sort({ createdAt: 'desc' })
    .limit(clampLimit(limit, 4))
  return JSON.parse(JSON.stringify(products)) as {
    name: string
    href: string
    image: string
  }[]
}

//* GET PRODUCTS BY TAG
export async function getProductsByTag({
  tag,
  limit = 10,
}: {
  tag: string
  limit?: number
}) {
  await connectToDatabase()
  const products = await Product.find({
    tags: { $in: [tag] },
    isPublished: true,
  })
    .sort({ createdAt: 'desc' })
    .limit(clampLimit(limit, 10))
  return JSON.parse(JSON.stringify(products)) as IProduct[]
}

// GET ONE PRODUCT BY SLUG
export async function getProductBySlug(slug: string) {
  await connectToDatabase()
  const product = await Product.findOne({ slug, isPublished: true })
  if (!product) throw new Error('Product not found')
  return JSON.parse(JSON.stringify(product)) as IProduct
}

//* GET RELATED PRODUCTS WITH SAME CATEGORY
export async function getRelatedProductsByCategory({
  category,
  productId,
  limit = 4, //how many products per page
  page = 1, //current page number
}: {
  category: string
  productId: string
  limit?: number
  page: number
}) {


  await connectToDatabase()
  limit = clampLimit(limit, 4)
  const skipAmount = (clampPage(page) - 1) * limit // explaination down
  const conditions = {
    isPublished: true,
    category,
    _id: { $ne: productId }, //exclude the current product
  }
  const products = await Product.find(conditions)
    .sort({ numSales: 'desc' })
    .skip(skipAmount)
    .limit(limit)
  const productsCount = await Product.countDocuments(conditions)
  return {
    data: JSON.parse(JSON.stringify(products)) as IProduct[],
    totalPages: Math.ceil(productsCount / limit),
  }
}


// GET ALL PRODUCTS FOR SEARCHES AND QUERIES
export async function getAllProducts({
  query,
  limit,
  page,
  category,
  tag,
  price,
  rating,
  sort,
}: {
  query: string
  category: string
  tag: string
  limit?: number
  page: number
  price?: string
  rating?: string
  sort?: string
}) {
  const {
    common: { pageSize },
  } = await getSetting()

  limit = clampLimit(limit, pageSize)
  const safePage = clampPage(page)

  await connectToDatabase()

  const queryFilter =
    query && query !== 'all' // all is the default value given.
      ? {
          name: {
            $regex: escapeRegExp(query),
            $options: 'i',
          },
        }
      : {}


  const categoryFilter = category && category !== 'all' ? { category } : {}

  const tagFilter = tag && tag !== 'all' ? { tags: tag } : {}

  const ratingFilter =
    rating && rating !== 'all'
      ? {
          avgRating: {
            $gte: Number(rating),
          },
        }
      : {}

  // 10-50 = more than index0 , less than index1 , the check fields give for its values:   
  // value: '21-50'==> split the string into array then access it and covert it to number.
  const priceFilter =
    price && price !== 'all'
      ? {
          price: {
            $gte: Number(price.split('-')[0]),
            $lte: Number(price.split('-')[1]),
          },
        }
      : {}

  const order: Record<string, 1 | -1> =
    sort === 'best-selling' // default value given
      ? { numSales: -1 }
      : sort === 'price-low-to-high'
        ? { price: 1 }
        : sort === 'price-high-to-low'
          ? { price: -1 }
          : sort === 'avg-customer-review'
            ? { avgRating: -1 }
            : { _id: -1 }

  const isPublished = { isPublished: true }

  const products = await Product.find({
    ...queryFilter,
    ...tagFilter,   
    ...categoryFilter,   // category
    ...priceFilter,
    ...ratingFilter, // avgRating: { $gte: Number(rating),
    ...isPublished, // isPublished: true
  })
    .sort(order)
    .skip(limit * (safePage - 1))
    .limit(limit)
    .lean()

  const countProducts = await Product.countDocuments({
    ...queryFilter,
    ...tagFilter,   
    ...categoryFilter,   // category
    ...priceFilter,
    ...ratingFilter, // avgRating: { $gte: Number(rating),
    ...isPublished, // isPublished: true
  })

  return {
    products: JSON.parse(JSON.stringify(products)) as IProduct[],
    totalPages: Math.ceil(countProducts / limit),
    totalProducts: countProducts,
    from: limit * (safePage - 1) + 1,
    to: limit * (safePage - 1) + products.length,
  }
}

// GET ALL TAGS
export async function getAllTags() {
  await connectToDatabase()
  const tags = await Product.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: null, uniqueTags: { $addToSet: '$tags' } } },
    { $project: { _id: 0, uniqueTags: 1 } },
  ])
  
  return (
    (tags[0]?.uniqueTags
      .sort((a: string, b: string) => a.localeCompare(b))
      .map((x: string) =>
        x
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      ) as string[]) || []
  )
}


// DELETE PRODUCT - ADMIN
export async function deleteProduct(id: string) {
  const session = await auth()
      if(session?.user.role !== "admin")
        throw new Error('Admin permission required')
  try {
    await connectToDatabase()

    const openOrder = await Order.exists({
      'items.product': id,
      isPaid: { $ne: true },
      isCancelled: { $ne: true },
    })
    if (openOrder)
      throw new Error(
        'Product is part of an open order. Cancel or fulfil the order first.'
      )
    const heldStock = await StockReservation.exists({
      status: 'held',
      'items.product': id,
    })
    if (heldStock)
      throw new Error(
        'Product has stock held by an open order. Release it first.'
      )

    const res = await Product.findByIdAndDelete(id)
    if (!res) throw new Error('Product not found')
      //success ==> refresh the page
  
    await revalidateAllLocales(`/admin/products`)

    return {
      success: true,
      message: 'Product deleted successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// GET ALL PRODUCTS FOR ADMIN
export async function getAllProductsForAdmin({
  query,
  page = 1,
  sort = 'latest',
  limit,
}: {
  query: string
  page?: number
  sort?: string
  limit?: number
}) {
  await connectToDatabase()
  const session = await auth()
      if(session?.user.role !== "admin")
        throw new Error('Admin permission required')

  const {
    common: { pageSize },
  } = await getSetting()

  limit = clampLimit(limit, pageSize)
  const safePage = clampPage(page)

  const queryFilter =
    query && query !== 'all'
      ? {
          name: {
            $regex: escapeRegExp(query),
            $options: 'i',
          },
        }
      : {}

  const order: Record<string, 1 | -1> =
    sort === 'best-selling'
      ? { numSales: -1 }
      : sort === 'price-low-to-high'
        ? { price: 1 }
        : sort === 'price-high-to-low'
          ? { price: -1 }
          : sort === 'avg-customer-review'
            ? { avgRating: -1 }
            : { _id: -1 }
  const products = await Product.find({
    ...queryFilter,
  })
    .sort(order)
    .skip(limit * (safePage - 1))
    .limit(limit)
    .lean()

  const countProducts = await Product.countDocuments({
    ...queryFilter,
  })
  return {
    products: JSON.parse(JSON.stringify(products)) as IProduct[],
    totalPages: Math.ceil(countProducts / limit),
    totalProducts: countProducts,
    from: limit * (safePage - 1) + 1,
    to: limit * (safePage - 1) + products.length,
  }
}


// ADMIN ACTIONS FOR PRODUCTS:
// CREATE PRODUCT - ADMIN
export async function createProduct(data: IProductInput) {
  const session = await auth()
  if (session?.user.role !== "admin")
    throw new Error('Admin permission required')
  try {    
    await connectToDatabase()

    const product = ProductInputSchema.parse(data)
    await Product.create(normalizeProductVariants(product))
 
    await revalidateAllLocales(`/admin/products`)

    return {
      success: true,
      message: 'Product created successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// UPDATE PRODUCT - ADMIN
export async function updateProduct(data: z.infer<typeof ProductUpdateSchema>) {
  const session = await auth()
  if (session?.user.role !== 'admin')
    throw new Error('Admin permission required')
  try {
    await connectToDatabase()

    const product = ProductUpdateSchema.parse(data)
    const existing = await Product.findById(product._id)
    if (!existing) throw new Error('Product not found')

    const before = new Map(
      (existing.variants ?? []).map((variant) => [variant.id, variant])
    )
    const normalized = normalizeProductVariants(product)
    const submittedVariants = normalized.variants ?? []
    const update = {
      name: normalized.name,
      slug: normalized.slug,
      category: normalized.category,
      images: normalized.images,
      brand: normalized.brand,
      description: normalized.description,
      price: normalized.price,
      listPrice: normalized.listPrice,
      lowStockThreshold: normalized.lowStockThreshold ?? 5,
      tags: normalized.tags,
      sizes: normalized.sizes,
      colors: normalized.colors,
      isPublished: normalized.isPublished,
      taxCategory: normalized.taxCategory,
      exemptionReasonCode: normalized.exemptionReasonCode,
      returnPolicy: normalized.returnPolicy,
    }

    const submittedIds = new Set(submittedVariants.map((variant) => variant.id))
    const removedVariantIds = [...before.keys()].filter(
      (variantId) => !submittedIds.has(variantId)
    )
    if (removedVariantIds.length > 0) {
      const activeHold = await StockReservation.exists({
        status: 'held',
        'items.product': String(existing._id),
        'items.variantId': { $in: removedVariantIds },
      })
      if (activeHold)
        throw new Error(
          'A variant with an active stock hold cannot be removed. Release or fulfil the order first.'
        )
    }

    // Preserve the live stock of every existing variant inside the database
    // write itself. A stale product form can change metadata, but it can never
    // restore stock that a reservation/return already consumed.
    await Product.updateOne({ _id: product._id }, [
      {
        $set: {
          ...update,
          updatedAt: new Date(),
          variants: {
            $map: {
              input: { $literal: submittedVariants },
              as: 'variant',
              in: {
                $mergeObjects: [
                  '$$variant',
                  {
                    countInStock: {
                      $let: {
                        vars: {
                          current: {
                            $first: {
                              $filter: {
                                input: { $ifNull: ['$variants', []] },
                                as: 'existing',
                                cond: {
                                  $eq: ['$$existing.id', '$$variant.id'],
                                },
                              },
                            },
                          },
                        },
                        in: {
                          $ifNull: [
                            '$$current.countInStock',
                            {
                              $cond: [
                                {
                                  $eq: [
                                    {
                                      $size: {
                                        $ifNull: ['$variants', []],
                                      },
                                    },
                                    0,
                                  ],
                                },
                                '$countInStock',
                                '$$variant.countInStock',
                              ],
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $set: {
          countInStock: { $sum: '$variants.countInStock' },
        },
      },
    ])

    const updated = await Product.findById(product._id)
    if (!updated) throw new Error('Product not found after update')
    const after = new Map(
      (updated.variants ?? []).map((variant) => [variant.id, variant])
    )

    for (const [variantId, variant] of after) {
      if (before.has(variantId)) continue
      const previousStock = before.size === 0 ? existing.countInStock : 0
      if (previousStock === variant.countInStock) continue
      await recordInventoryAdjustment({
        product: String(existing._id),
        productName: existing.name,
        variantId,
        sku: variant.sku,
        variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '),
        previousStock,
        newStock: variant.countInStock,
        quantityChange: variant.countInStock - previousStock,
        source: 'product_update',
        reason:
          before.size === 0
            ? 'legacy stock migrated to default variant'
            : 'variant created',
        actorId: session?.user?.id,
        actorEmail: session?.user?.email ?? '',
      })
    }
    for (const [variantId, variant] of before) {
      if (after.has(variantId)) continue
      await recordInventoryAdjustment({
        product: String(existing._id),
        productName: existing.name,
        variantId,
        sku: variant.sku,
        variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '),
        previousStock: variant.countInStock,
        newStock: 0,
        quantityChange: -variant.countInStock,
        source: 'product_update',
        reason: 'variant removed',
        actorId: session?.user?.id,
        actorEmail: session?.user?.email ?? '',
      })
    }

    await revalidateAllLocales(`/admin/products`)
    await revalidateAllLocales(`/admin/inventory`)

    return {
      success: true,
      message: 'Product updated successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// GET ONE PRODUCT BY ID - ADMIN
export async function getProductById(productId: string) {
  const session = await auth()
  if (session?.user.role !== 'admin')
    throw new Error('Admin permission required')

  await connectToDatabase()
  const product = await Product.findById(productId)
  return JSON.parse(JSON.stringify(product)) as IProduct
}

// GET ALL SLUGS OF PRODUCTS - PUBLIC
export async function getAllProductSlugs() {
  await connectToDatabase()
  // const slugs = await Product.find({}, 'slug -_id').lean(); or 
    const slugs = await Product.find({ isPublished: true }).select({
      slug: 1,
      _id: 0,
    });

     if (!slugs) throw new Error('Products not found')
 
  return JSON.parse(JSON.stringify(slugs))
}

// GET ALL PRODUCTS FOR SITEMAP- PUBLIC
export async function getAllProductsForSitemap() {
  await connectToDatabase()
  const products = await Product.find({ isPublished: true }, 'slug updatedAt')
    .sort({ updatedAt: -1 })
    .lean()

  if (!products) throw new Error('Products not found')

  return JSON.parse(JSON.stringify(products)) as { slug: string; updatedAt: Date }[]
}
