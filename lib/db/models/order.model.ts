import { IOrderInput } from '@/types'
import { Document, Model, model, models, Schema } from 'mongoose'

import { RETURN_POLICIES } from '@/lib/returns/policy'

// omit = replace _id of document with _id of mongoose type
export interface IOrder extends Omit<Document, '_id'>, IOrderInput {
  _id: string
  createdAt: Date
  updatedAt: Date
  receiptSentAt?: Date
  moyasarPaymentId?: string
  isCancelled?: boolean
  cancelledAt?: Date
  cancelReason?: string
  refundedAmount?: number
  refundedAt?: Date
  shippingRefunded?: boolean
  refundHistory?: {
    amount: number
    provider: string
    refundedAt: Date
    reason?: string
    returnId?: string
    reference?: string
  }[]
}

export type OrderWithUser = Omit<IOrder, 'user'> & {
  user: { _id: string, email: string, name: string }
}

// type: Schema.Types.ObjectId ==> this is a reference to another schema in MONGODB
// {type: Schema.Types.ObjectId, ref: "Schema-Name", required: "true"}
const orderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId as unknown as typeof String,
      ref: 'User',
      required: true,
    },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        clientId: { type: String, required: true },
        name: { type: String, required: true },
        slug: { type: String, required: true },
        image: { type: String, required: true },
        category: { type: String, required: true },
        price: { type: Number, required: true },
        taxCategory: {
          type: String,
          enum: ['S', 'Z', 'E', 'O'],
          required: true,
          default: 'S',
        },
        exemptionReasonCode: { type: String, default: '' },
        returnPolicy: {
          type: String,
          enum: RETURN_POLICIES,
          required: true,
          default: 'return_and_refund',
        },
        refundedQuantity: { type: Number, default: 0 },
        restockedQuantity: { type: Number, default: 0 },
        netPrice: { type: Number },
        vatAmount: { type: Number, default: 0 },
        vatPercent: { type: Number, default: 0 },
        countInStock: { type: Number, required: true },
        quantity: { type: Number, required: true },
        size: { type: String },
        color: { type: String },
        variantId: { type: String, default: '' },
        sku: { type: String, default: '' },
        variantLabel: { type: String, default: '' },
      },
    ],
    shippingAddress: {
      fullName: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      province: { type: String, required: true },
      phone: { type: String, required: true },
    },
    expectedDeliveryDate: { type: Date, required: true },
    paymentMethod: { type: String, required: true },
    currency: { type: String, required: true, default: 'SAR' },
    paymentResult: {
      id: String,
      status: String,
      email_address: String,
      pricePaid: String,
    },
    receiptSentAt: { type: Date },
    itemsPrice: { type: Number, required: true },
    shippingPrice: { type: Number, required: true },
    taxPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    taxInclusive: { type: Boolean, required: true, default: true },
    taxRate: { type: Number, required: true, default: 0.15 },
    isPaid: { type: Boolean, required: true, default: false },
    paidAt: { type: Date },
    isDelivered: { type: Boolean, required: true, default: false },
    deliveredAt: { type: Date },
    // Stripe Step 1 intent ID — stored on creation, verified on success
    stripePaymentIntentId: { type: String },
    moyasarPaymentId: { type: String },
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
    refundedAmount: { type: Number, default: 0 },
    refundedAt: { type: Date },
    shippingRefunded: { type: Boolean, default: false },
    refundHistory: [
      {
        _id: false,
        amount: { type: Number, required: true },
        provider: { type: String, required: true },
        refundedAt: { type: Date, required: true },
        reason: { type: String },
        returnId: { type: String },
        reference: { type: String },
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)
// this is a mongoos method call by ==> import Order ==> Order.create(zod-Validated-Order-Obj)
const Order =
  (models.Order as Model<IOrder>) || model<IOrder>('Order', orderSchema)

export default Order
// Mongoose then takes this object and creates a new document in the MongoDB orders collection, adhering to the orderSchema you defined in order.model.ts.