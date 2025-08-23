'use server'

import mongoose from 'mongoose'
import { auth } from '@/auth'
import { connectToDatabase } from '../db'
import Product from '../db/models/product.model'
import Review, { IReview } from '../db/models/review.model'
import { formatError } from '../utils'
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

    // get data from Form , get user from session
    const review = ReviewInputSchema.parse({
      ...data,
      user: session?.user?.id,
    })

    await connectToDatabase()
    const existReview = await Review.findOne({
      product: review.product,
      user: review.user,
    })

    if (existReview) {
      existReview.comment = review.comment
      existReview.rating = review.rating
      existReview.title = review.title
      await existReview.save()
      await updateProductReview(review.product)
      await revalidateAllLocales(path)
      return {
        success: true,
        message: 'Review updated successfully',
        // data: JSON.parse(JSON.stringify(existReview)),
      }
    } else {
      await Review.create(review)
      await updateProductReview(review.product)
      await revalidateAllLocales(path)
      return {
        success: true,
        message: 'Review created successfully',
        // data: JSON.parse(JSON.stringify(newReview)),
      }
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
  // get all reviews to this product, then group them by the value of the rating field "one-star""two-stars", $sum is accumulator(count no.of docs in each group"120","85").
  //? ex. return  result = [  { _id: 5, count: 120 },   { _id: 4, count: 85 }, ....] , think of it _id= star.
   const session = await auth()
    if (!session) {
      throw new Error('User is not authenticated')
    }

  const result = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
  ])
  
  // (sum, item) => sum + item.count ,destructuring { count }. 
  //? ex. return  totalReviews=240
  const totalReviews = result.reduce((sum, { count }) => sum + count, 0)

  // sum = accumulator. 
  //? ex. return avgRating=(e.g., `(5*120) + (4*85) + (3*30) + (1*5) = 1035`) / 240 = 4.134
  const avgRating =
    result.reduce((sum, { _id, count }) => sum + _id * count, 0) / totalReviews

  // Convert aggregation result to a map for easier lookup,
  //?  ratingMap=[{5:120}, {4:85}, ...]
  const ratingMap = result.reduce((map, { _id, count }) => {
    map[_id] = count
    return map
  }, {})

  // Ensure all ratings 1-5 are represented, with missing ones set to count: 0
  //? ratingDistribution=[{rating:1, count:120}, {rating:2, count:0}, {rating:3, count:30}, ....] , it add {rating:2, count:0} 
  const ratingDistribution = []
  for (let i = 1; i <= 5; i++) {
    ratingDistribution.push({ rating: i, count: ratingMap[i] || 0 })
  }

  //? findByIdAndUpdate is a Mongoose command, Update product fields with calculated values
  await Product.findByIdAndUpdate(productId, {
    avgRating: avgRating.toFixed(1),
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

    const {
    common: { pageSize },
  } = await getSetting()
  
  limit = limit || pageSize

  await connectToDatabase()
  const skipAmount = (page - 1) * limit
  const reviews = await Review.find({ product: productId })
    .populate('user', 'name')
    .sort({
      createdAt: 'desc',
    })
    .skip(skipAmount)
    .limit(limit)
//   console.log(reviews)
  const reviewsCount = await Review.countDocuments({ product: productId })
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