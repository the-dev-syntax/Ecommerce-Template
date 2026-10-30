'use server'

import mongoose from 'mongoose'
import { auth } from '@/auth'
import { requireAdmin } from '@/lib/access'
import { connectToDatabase } from '../db'
import Product from '../db/models/product.model'
import Order from '../db/models/order.model'
import Review, { IReview } from '../db/models/review.model'
import { clampLimit, clampPage, formatError } from '../utils'
import { ReviewInputSchema } from '../validator'
import { IReviewDetails, IReviewInput } from '@/types'
import { getSetting } from './setting.actions'
import { revalidateAllLocales } from '../utils-serverOnly'

// CREATE OR UPDATE REVIEW - PRIVATE
export async function createUpdateReview({
  data,
  path,
}: {
  data: IReviewInput
  path: string
}) {
  try {
    const session = await auth()
    if (!session) {
      throw new Error('User is not authenticated')
    }

    const { features } = await getSetting()
    if (!features.reviews) throw new Error('Product reviews are disabled')

    // get data from Form , get user from session
    const review = ReviewInputSchema.parse({
      ...data,
      user: session?.user?.id,
    })

    await connectToDatabase()

    // Only customers with a paid order containing this product may review it.
    // The client's "verified purchase" flag is never trusted.
    const purchased = await Order.exists({
      user: session.user.id,
      isPaid: true,
      'items.product': review.product,
    })
    if (!purchased)
      throw new Error('Only customers who purchased this product can review it')

    const existReview = await Review.findOne({
      product: review.product,
      user: review.user,
    })

    if (existReview) {
      existReview.comment = review.comment
      existReview.rating = review.rating
      existReview.title = review.title
      existReview.isVerifiedPurchase = true
      // An edit needs a fresh approval, otherwise a user could get a harmless
      // review approved and then replace its text.
      existReview.isApproved = false
      existReview.approvedAt = undefined
      existReview.approvedBy = undefined
      await existReview.save()
      await updateProductReview(review.product)
      await revalidateAllLocales(path)
      return {
        success: true,
        message: 'Review updated and submitted for approval',
      }
    }

    await Review.create({
      ...review,
      isVerifiedPurchase: true,
      isApproved: false,
    })
    await revalidateAllLocales(path)
    return {
      success: true,
      message: 'Review submitted for approval',
    }
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    }
  }
}

// HELPER FN TO UPDATE ONE REVIEW - PRIVATE
const updateProductReview = async (productId: string) => {
  // Only published reviews contribute to the public rating and distribution.
  // Reviews created before moderation existed have no isApproved field and are
  // grandfathered as published; pending/edited reviews are explicitly false.
  const result = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        isApproved: { $ne: false },
      },
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
  ])

  const totalReviews = result.reduce((sum, { count }) => sum + count, 0)
  const avgRating =
    totalReviews === 0
      ? 0
      : Number(
          (
            result.reduce((sum, { _id, count }) => sum + _id * count, 0) /
            totalReviews
          ).toFixed(1)
        )

  const ratingMap = result.reduce<Record<string, number>>(
    (map, { _id, count }) => {
      map[_id] = count
      return map
    },
    {}
  )

  const ratingDistribution = []
  for (let i = 1; i <= 5; i++) {
    ratingDistribution.push({ rating: i, count: ratingMap[i] || 0 })
  }

  await Product.findByIdAndUpdate(productId, {
    avgRating,
    numReviews: totalReviews,
    ratingDistribution,
  })
}

// GET ALL REVIEWS - PUBLIC
export async function getReviews({
  productId,
  limit,
  page,
}: {
  productId: string
  limit?: number
  page: number
}) {
  if (!mongoose.isValidObjectId(productId))
    return { data: [] as IReviewDetails[], totalPages: 1 }

  const {
    common: { pageSize },
  } = await getSetting()

  limit = clampLimit(limit, pageSize)

  await connectToDatabase()
  const skipAmount = (clampPage(page) - 1) * limit
  const query = { product: productId, isApproved: { $ne: false } }
  const [reviews, reviewsCount] = await Promise.all([
    Review.find(query)
      .populate('user', 'name')
      .sort({ createdAt: 'desc' })
      .skip(skipAmount)
      .limit(limit),
    Review.countDocuments(query),
  ])

  return {
    data: JSON.parse(JSON.stringify(reviews)) as IReviewDetails[],
    totalPages: reviewsCount === 0 ? 1 : Math.ceil(reviewsCount / limit),
  }
}

// GET ONE REVIEW - PRIVATE
export const getReviewByProductId = async ({
  productId,
}: {
  productId: string
}) => {
  await connectToDatabase()
  const session = await auth()
  if (!session) {
    throw new Error('User is not authenticated')
  }

  const review = await Review.findOne({
    product: productId,
    user: session?.user?.id,
  })
  return review ? (JSON.parse(JSON.stringify(review)) as IReview) : null
}

// GET PENDING REVIEWS - ADMIN
export async function getPendingReviews({
  page = 1,
  limit,
}: {
  page?: number
  limit?: number
}) {
  const session = await auth()
  requireAdmin(session)

  const {
    common: { pageSize },
  } = await getSetting()
  limit = clampLimit(limit, pageSize)

  await connectToDatabase()
  const skipAmount = (clampPage(page) - 1) * limit
  // Only explicitly pending reviews. Legacy rows without the field were
  // already public and are grandfathered as approved.
  const query = { isApproved: false }

  const [reviews, totalPending] = await Promise.all([
    Review.find(query)
      .populate('user', 'name email')
      .populate('product', 'name slug')
      .sort({ createdAt: 'asc' })
      .skip(skipAmount)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
  ])

  return {
    data: JSON.parse(JSON.stringify(reviews)),
    totalPages: totalPending === 0 ? 1 : Math.ceil(totalPending / limit),
    totalPending,
  }
}

async function revalidateReviewProduct(productId: string) {
  const product = await Product.findById(productId).select('slug').lean()
  if (product?.slug) await revalidateAllLocales(`/product/${product.slug}`)
  await revalidateAllLocales('/admin/reviews')
}

// APPROVE REVIEW - ADMIN
export async function approveReview(id: string) {
  try {
    const session = await auth()
    requireAdmin(session)
    if (!mongoose.isValidObjectId(id)) throw new Error('Invalid review id')

    await connectToDatabase()
    const review = await Review.findById(id)
    if (!review) throw new Error('Review not found')

    if (!review.isApproved) {
      review.isApproved = true
      review.approvedAt = new Date()
      review.approvedBy = session?.user?.id
      await review.save()
    }

    await updateProductReview(String(review.product))
    await revalidateReviewProduct(String(review.product))

    return { success: true, message: 'Review approved' }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// DELETE REVIEW - ADMIN
export async function deleteReview(id: string) {
  try {
    const session = await auth()
    requireAdmin(session)
    if (!mongoose.isValidObjectId(id)) throw new Error('Invalid review id')

    await connectToDatabase()
    const review = await Review.findByIdAndDelete(id)
    if (!review) throw new Error('Review not found')

    await updateProductReview(String(review.product))
    await revalidateReviewProduct(String(review.product))

    return { success: true, message: 'Review deleted' }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}
