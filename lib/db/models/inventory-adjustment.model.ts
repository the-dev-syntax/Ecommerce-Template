import { Document, Model, model, models, Schema } from 'mongoose'

export type InventoryAdjustmentSource =
  | 'manual'
  | 'product_update'
  | 'order_reserved'
  | 'order_fulfilled'
  | 'order_cancelled'
  | 'return_restocked'
  | 'reservation_released'
  | 'reservation_expired'

export interface IInventoryAdjustment extends Omit<Document, '_id'> {
  _id: string
  product: string
  productName: string
  variantId?: string
  sku?: string
  variantLabel?: string
  previousStock: number
  newStock: number
  quantityChange: number
  source: InventoryAdjustmentSource
  reason?: string
  note?: string
  orderId?: string
  returnId?: string
  actorId?: string
  actorEmail?: string
  createdAt: Date
  updatedAt: Date
}

const inventoryAdjustmentSchema = new Schema<IInventoryAdjustment>(
  {
    product: { type: String, required: true, index: true },
    productName: { type: String, required: true },
    variantId: { type: String, default: '' },
    sku: { type: String, default: '' },
    variantLabel: { type: String, default: '' },
    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },
    quantityChange: { type: Number, required: true },
    source: {
      type: String,
      enum: [
        'manual',
        'product_update',
        'order_reserved',
        'order_fulfilled',
        'order_cancelled',
        'return_restocked',
        'reservation_released',
        'reservation_expired',
      ],
      required: true,
    },
    reason: { type: String, default: '' },
    note: { type: String, default: '' },
    orderId: { type: String, default: '' },
    returnId: { type: String, default: '' },
    actorId: { type: String, default: '' },
    actorEmail: { type: String, default: '' },
  },
  { timestamps: true }
)

inventoryAdjustmentSchema.index({ createdAt: -1 })
inventoryAdjustmentSchema.index({ product: 1, variantId: 1, createdAt: -1 })

const InventoryAdjustment =
  (models.InventoryAdjustment as Model<IInventoryAdjustment>) ||
  model<IInventoryAdjustment>('InventoryAdjustment', inventoryAdjustmentSchema)

export default InventoryAdjustment
