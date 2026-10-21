import { Document, Model, model, models, Schema } from 'mongoose'

export interface IShippingRate extends Omit<Document, '_id'> {
  _id: string
  zoneName: string
  country: string
  region: string
  city: string
  carrier: string
  serviceName: string
  baseRate: number
  includedWeightKg: number
  extraPerKg: number
  weightRoundingKg: number
  freeShippingMinPrice: number
  codFee: number
  remoteSurcharge: number
  etaMinDays: number
  etaMaxDays: number
  pickupAvailable: boolean
  codAvailable: boolean
  isActive: boolean
  priority: number
  effectiveFrom?: Date
  createdAt: Date
  updatedAt: Date
}

const shippingRateSchema = new Schema<IShippingRate>(
  {
    zoneName: { type: String, required: true, default: 'Saudi Arabia' },
    country: { type: String, required: true, default: 'Saudi Arabia' },
    region: { type: String, required: true, default: '*' },
    city: { type: String, required: true, default: '*' },
    carrier: { type: String, required: true, default: 'SMSA' },
    serviceName: { type: String, required: true, default: 'Express' },
    baseRate: { type: Number, required: true, default: 20 },
    includedWeightKg: { type: Number, required: true, default: 1 },
    extraPerKg: { type: Number, required: true, default: 5 },
    weightRoundingKg: { type: Number, required: true, default: 1 },
    freeShippingMinPrice: { type: Number, required: true, default: 200 },
    codFee: { type: Number, required: true, default: 10 },
    remoteSurcharge: { type: Number, required: true, default: 0 },
    etaMinDays: { type: Number, required: true, default: 1 },
    etaMaxDays: { type: Number, required: true, default: 2 },
    pickupAvailable: { type: Boolean, required: true, default: true },
    codAvailable: { type: Boolean, required: true, default: true },
    isActive: { type: Boolean, required: true, default: true },
    priority: { type: Number, required: true, default: 0 },
    effectiveFrom: { type: Date },
  },
  { timestamps: true }
)

shippingRateSchema.index({ region: 1, city: 1, isActive: 1, priority: -1 })

const ShippingRate =
  (models.ShippingRate as Model<IShippingRate>) ||
  model<IShippingRate>('ShippingRate', shippingRateSchema)

export default ShippingRate
