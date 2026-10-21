import { Document, Model, model, models, Schema } from 'mongoose'

export type PaymentEventStatus =
  | 'received'
  | 'processed'
  | 'ignored'
  | 'failed'

export interface IPaymentEvent extends Omit<Document, '_id'> {
  _id: string
  provider: string
  eventId: string
  type: string
  orderId?: string
  status: PaymentEventStatus
  message?: string
  receivedAt: Date
  updatedAt: Date
}

const paymentEventSchema = new Schema<IPaymentEvent>(
  {
    provider: { type: String, required: true, index: true },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    orderId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['received', 'processed', 'ignored', 'failed'],
      required: true,
      default: 'received',
    },
    message: { type: String, default: '' },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
)

paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true })
paymentEventSchema.index({ receivedAt: -1 })

const PaymentEvent =
  (models.PaymentEvent as Model<IPaymentEvent>) ||
  model<IPaymentEvent>('PaymentEvent', paymentEventSchema)

export default PaymentEvent
