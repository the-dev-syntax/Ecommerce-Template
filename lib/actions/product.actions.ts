'use server'

import { connectToDatabase } from '@/lib/db'
import Product, { IProduct } from '@/lib/db/models/product.model'
// import { PAGE_SIZE } from '../constants'

import { revalidatePath } from 'next/cache'
import { formatError } from '../utils'

import { ProductInputSchema, ProductUpdateSchema } from '../validator'
import { IProductInput } from '@/types'
import { z } from 'zod'
import { auth } from '@/auth'
import { getSetting } from './setting.actions'



  

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
    .limit(limit)
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
    .limit(limit)
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
  const skipAmount = (Number(page) - 1) * limit // explaination down
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

  limit = limit || pageSize
 

  await connectToDatabase()

  const queryFilter =
    query && query !== 'all' // all is the default value given.
      ? {
          name: {
            $regex: query,
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
    .skip(limit * (Number(page) - 1))
    .limit(limit)
    .lean()

  const countProducts = await Product.countDocuments({
    ...queryFilter,
    ...tagFilter,
    ...categoryFilter,
    ...priceFilter,
    ...ratingFilter,
  })

  return {
    products: JSON.parse(JSON.stringify(products)) as IProduct[],
    totalPages: Math.ceil(countProducts / limit),
    totalProducts: countProducts,
    from: limit * (Number(page) - 1) + 1,
    to: limit * (Number(page) - 1) + products.length,
  }
}

// GET ALL TAGS
export async function getAllTags() {

  const tags = await Product.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: null, uniqueTags: { $addToSet: '$tags' } } },
    { $project: { _id: 0, uniqueTags: 1 } },
  ])
  // const returnedTags = (tags[0]?.uniqueTags
  //     .sort((a: string, b: string) => a.localeCompare(b))
  //     .map((x: string) =>
  //       x
  //         .split('-')
  //         .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  //         .join(' ')
  //     ) as string[]) || []
  //     console.log(returnedTags)
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
  try {
    await connectToDatabase()
    const session = await auth()
        if(session?.user.role !== "Admin")
          throw new Error('Admin permission required')

    const res = await Product.findByIdAndDelete(id)
    if (!res) throw new Error('Product not found')
      //success ==> refresh the page
    revalidatePath('/admin/products')
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
      if(session?.user.role !== "Admin")
        throw new Error('Admin permission required')

  const {
    common: { pageSize },
  } = await getSetting()

  limit = limit || pageSize

  const queryFilter =
    query && query !== 'all'
      ? {
          name: {
            $regex: query,
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
    .skip(limit * (Number(page) - 1))
    .limit(limit)
    .lean()

  const countProducts = await Product.countDocuments({
    ...queryFilter,
  })
  return {
    products: JSON.parse(JSON.stringify(products)) as IProduct[],
    totalPages: Math.ceil(countProducts / pageSize),
    totalProducts: countProducts,
    from: pageSize * (Number(page) - 1) + 1,
    to: pageSize * (Number(page) - 1) + products.length,
  }
}


// ADMIN ACTIONS FOR PRODUCTS:
// CREATE PRODUCT - ADMIN
export async function createProduct(data: IProductInput) {
  try {    
    await connectToDatabase()
    const session = await auth()
    if (session?.user.role !== "Admin")
      throw new Error('Admin permission required')

    const product = ProductInputSchema.parse(data)
    await Product.create(product)
    revalidatePath('/admin/products')
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
  try {
    await connectToDatabase()
    const session = await auth()
    if (session?.user.role !== "Admin")
      throw new Error('Admin permission required')

    const product = ProductUpdateSchema.parse(data)
    await Product.findByIdAndUpdate(product._id, product)
    revalidatePath('/admin/products')
    return {
      success: true,
      message: 'Product updated successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// GET ONE PRODUCT BY ID - PUBLIC
export async function getProductById(productId: string) {
  await connectToDatabase()
  const product = await Product.findById(productId)
  return JSON.parse(JSON.stringify(product)) as IProduct
}

// GET ALL SLUGS OF PRODUCTS - PUBLIC
export async function getAllProductSlugs() {
  await connectToDatabase()
  // const slugs = await Product.find({}, 'slug -_id').lean(); or 
    const slugs = await Product.find().select({ slug: 1, _id: 0 });
 
  return JSON.parse(JSON.stringify(slugs))
}
