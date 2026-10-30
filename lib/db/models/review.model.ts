import { IReviewInput } from '@/types'
import { Document, Model, model, models, Schema } from 'mongoose'

export interface IReview extends Omit<Document, '_id'>, IReviewInput {
  _id: string
  isVerifiedPurchase: boolean
  // Reviews are hidden from the storefront until an admin approves them.
  isApproved: boolean
  approvedAt?: Date
  approvedBy?: string
  createdAt: Date
  updatedAt: Date
}
const reviewSchema = new Schema<IReview>(
  {
    user: {
      type: Schema.Types.ObjectId as unknown as typeof String,
      ref: 'User',
    },
    isVerifiedPurchase: {
      type: Boolean,
      required: true,
      default: false,
    },
    isApproved: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    approvedAt: { type: Date },
    approvedBy: { type: String },
    product: {
      type: Schema.Types.ObjectId as unknown as typeof String,
      ref: 'Product',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

// Product pages load reviews by product; the upsert check also filters by user.
reviewSchema.index({ product: 1, isApproved: 1, createdAt: -1 })
reviewSchema.index({ product: 1, user: 1 })
reviewSchema.index({ isApproved: 1, createdAt: -1 })

const Review =
  (models.Review as Model<IReview>) || model<IReview>('Review', reviewSchema)

export default Review