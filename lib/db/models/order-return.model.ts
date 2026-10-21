import { Document, Model, model, models, Schema } from 'mongoose'

import {
  RETURN_POLICIES,
  type RefundReason,
  type ReturnPolicy,
} from '@/lib/returns/policy'

export type OrderReturnKind = 'return' | 'cancellation'
export type RefundProvider = 'Moyasar' | 'Manual'

export interface IOrderReturnItem {
  clientId: string
  product: string
  name: string
  quantity: number
  returnPolicy: ReturnPolicy
  variantId?: string
  sku?: string
  variantLabel?: string
  netAmount: number
  vatAmount: number
  grossAmount: number
  restocked: boolean
}

export interface IOrderReturn extends Omit<Document, '_id'> {
  _id: string
  orderId: string
  kind: OrderReturnKind
  idempotencyKey: string
  items: IOrderReturnItem[]
  reason: RefundReason
  policyOverrideReason?: string
  shippingRefunded: boolean
  shippingAmount: number
  refundAmount: number
  refundProvider: RefundProvider
  refundReference?: string
  refundedAt: Date
  createdBy?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const orderReturnSchema = new Schema<IOrderReturn>(
  {
    orderId: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: ['return', 'cancellation'],
      required: true,
      default: 'return',
    },
    idempotencyKey: { type: String, required: true },
    items: [
      {
        _id: false,
        clientId: { type: String, required: true },
        product: { type: String, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        returnPolicy: {
          type: String,
          enum: RETURN_POLICIES,
          required: true,
        },
        variantId: { type: String, default: '' },
        sku: { type: String, default: '' },
        variantLabel: { type: String, default: '' },
        netAmount: { type: Number, required: true },
        vatAmount: { type: Number, required: true },
        grossAmount: { type: Number, required: true },
        restocked: { type: Boolean, required: true, default: false },
      },
    ],
    reason: { type: String, required: true },
    policyOverrideReason: { type: String, default: '' },
    shippingRefunded: { type: Boolean, required: true, default: false },
    shippingAmount: { type: Number, required: true, default: 0 },
    refundAmount: { type: Number, required: true },
    refundProvider: {
      type: String,
      enum: ['Moyasar', 'Manual'],
      required: true,
    },
    refundReference: { type: String, default: '' },
    refundedAt: { type: Date, required: true },
    createdBy: { type: String, default: '' },
    notes: { type: String },
  },
  { timestamps: true }
)

orderReturnSchema.index(
  { orderId: 1, idempotencyKey: 1 },
  { unique: true }
)
orderReturnSchema.index({ orderId: 1, createdAt: -1 })

const OrderReturn =
  (models.OrderReturn as Model<IOrderReturn>) ||
  model<IOrderReturn>('OrderReturn', orderReturnSchema)

export default OrderReturn
