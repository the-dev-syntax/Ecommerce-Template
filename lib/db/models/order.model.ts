import { IOrderInput } from '@/types'
import { Document, Model, model, models, Schema } from 'mongoose'

export interface IOrder extends Document, IOrderInput {
  _id: string
  createdAt: Date
  updatedAt: Date
}
// type: Schema.Types.ObjectId as unknown as typeof String, ref:"User"  ==> this is a reference to another schema in MONGODB
// this is the way to reference another Mongo Schema by creating these objects user and product :
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
        countInStock: { type: Number, required: true },
        quantity: { type: Number, required: true },
        size: { type: String },
        color: { type: String },
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
    paymentResult: { id: String, status: String, email_address: String },
    itemsPrice: { type: Number, required: true },
    shippingPrice: { type: Number, required: true },
    taxPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    isPaid: { type: Boolean, required: true, default: false },
    paidAt: { type: Date },
    isDelivered: { type: Boolean, required: true, default: false },
    deliveredAt: { type: Date },
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