import { Document, Model, model, models, Schema } from 'mongoose'

export type InvoiceType = 'invoice' | 'credit_note'

export interface IInvoiceSellerSnapshot {
  legalNameEn: string
  legalNameAr: string
  vatNumber: string
  crNumber?: string
  nationalAddress?: string
  street?: string
  buildingNumber?: string
  citySubdivision?: string
  city?: string
  postalCode?: string
  country?: string
  email?: string
  phone?: string
}

export interface IInvoiceBuyerSnapshot {
  name: string
  email?: string
  phone?: string
  address?: string
}

export interface IInvoiceItemSnapshot {
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  taxCategory: 'S' | 'Z' | 'E' | 'O'
  exemptionReasonCode?: string
  vatPercent: number
  vatAmount: number
}

export interface IInvoice extends Omit<Document, '_id'> {
  _id: string
  number: string
  type: InvoiceType
  orderId: string
  issuedAt: Date
  currency: string
  seller: IInvoiceSellerSnapshot
  buyer: IInvoiceBuyerSnapshot
  items: IInvoiceItemSnapshot[]
  itemsPrice: number
  shippingPrice: number
  vatAmount: number
  total: number
  refundedAmount?: number
  originalInvoiceNumber?: string
  qrPayload: string
  notes?: string
  createdAt: Date
}

const invoiceSchema = new Schema<IInvoice>(
  {
    number: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['invoice', 'credit_note'],
      required: true,
    },
    orderId: { type: String, required: true, index: true },
    issuedAt: { type: Date, required: true },
    currency: { type: String, required: true },
    seller: {
      legalNameEn: { type: String, required: true },
      legalNameAr: { type: String, required: true },
      vatNumber: { type: String, required: true },
      crNumber: { type: String, default: '' },
      nationalAddress: { type: String, default: '' },
      street: { type: String, default: '' },
      buildingNumber: { type: String, default: '' },
      citySubdivision: { type: String, default: '' },
      city: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: 'SA' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    buyer: {
      name: { type: String, required: true },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    items: [
      {
        _id: false,
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        lineTotal: { type: Number, required: true },
        taxCategory: {
          type: String,
          enum: ['S', 'Z', 'E', 'O'],
          required: true,
          default: 'S',
        },
        exemptionReasonCode: { type: String, default: '' },
        vatPercent: { type: Number, required: true, default: 0 },
        vatAmount: { type: Number, required: true, default: 0 },
      },
    ],
    itemsPrice: { type: Number, required: true },
    shippingPrice: { type: Number, required: true, default: 0 },
    vatAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    refundedAmount: { type: Number },
    originalInvoiceNumber: { type: String },
    qrPayload: { type: String, required: true },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
)

// One tax invoice and one credit note per order. This is the idempotency guard
// and also prevents duplicate numbering under concurrent webhook deliveries.
invoiceSchema.index({ orderId: 1, type: 1 }, { unique: true })
invoiceSchema.index({ issuedAt: -1 })

// ZATCA records must be append-only. Block every update/delete path used by the
// app so a bug or a malicious admin action cannot rewrite invoice history.
invoiceSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('Invoices are immutable'))
  next()
})

for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  invoiceSchema.pre(operation, function (next) {
    next(new Error('Invoices are immutable'))
  })
}

export interface IInvoiceCounter extends Omit<Document, '_id'> {
  _id: string
  seq: number
}

const invoiceCounterSchema = new Schema<IInvoiceCounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
)

export const InvoiceCounter =
  (models.InvoiceCounter as Model<IInvoiceCounter>) ||
  model<IInvoiceCounter>('InvoiceCounter', invoiceCounterSchema)

const Invoice =
  (models.Invoice as Model<IInvoice>) ||
  model<IInvoice>('Invoice', invoiceSchema)

export default Invoice
