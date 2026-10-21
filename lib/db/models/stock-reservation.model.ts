import { Document, Model, model, models, Schema } from 'mongoose'

export interface IStockReservationItem {
  product: string
  variantId?: string
  quantity: number
}

export interface IStockReservation extends Omit<Document, '_id'> {
  _id: string
  orderId: string
  items: IStockReservationItem[]
  status: 'held' | 'committed' | 'released'
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

const stockReservationSchema = new Schema<IStockReservation>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    items: [
      {
        _id: false,
        product: { type: String, required: true },
        variantId: { type: String, default: '' },
        quantity: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['held', 'committed', 'released'],
      required: true,
      default: 'held',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
)

const StockReservation =
  (models.StockReservation as Model<IStockReservation>) ||
  model<IStockReservation>('StockReservation', stockReservationSchema)

export default StockReservation
