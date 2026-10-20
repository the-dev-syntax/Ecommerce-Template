import { Document, Model, model, models, Schema } from 'mongoose'

export type ZatcaSubmissionStatus =
  | 'queued'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'failed'

export type ZatcaInvoiceType = 'invoice' | 'credit_note'

export interface IZatcaSubmission extends Omit<Document, '_id'> {
  _id: string
  invoiceId: string
  orderId: string
  type: ZatcaInvoiceType
  environment: 'sandbox' | 'production'
  uuid: string
  icv?: number
  pih?: string
  invoiceHash?: string
  qrPayload?: string
  signedXml?: string
  status: ZatcaSubmissionStatus
  attempts: number
  zatcaWarnings?: unknown[]
  zatcaErrors?: unknown[]
  reportedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const zatcaSubmissionSchema = new Schema<IZatcaSubmission>(
  {
    invoiceId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['invoice', 'credit_note'],
      required: true,
    },
    environment: {
      type: String,
      enum: ['sandbox', 'production'],
      required: true,
    },
    uuid: { type: String, required: true, unique: true },
    icv: { type: Number },
    pih: { type: String },
    invoiceHash: { type: String },
    qrPayload: { type: String },
    signedXml: { type: String },
    status: {
      type: String,
      enum: ['queued', 'pending', 'accepted', 'rejected', 'failed'],
      required: true,
      default: 'queued',
      index: true,
    },
    attempts: { type: Number, required: true, default: 0 },
    zatcaWarnings: { type: [Schema.Types.Mixed], default: [] },
    zatcaErrors: { type: [Schema.Types.Mixed], default: [] },
    reportedAt: { type: Date },
  },
  { timestamps: true }
)

zatcaSubmissionSchema.index({ status: 1, createdAt: 1 })

export const ZatcaSubmission =
  (models.ZatcaSubmission as Model<IZatcaSubmission>) ||
  model<IZatcaSubmission>('ZatcaSubmission', zatcaSubmissionSchema)

export interface IZatcaChainState extends Omit<Document, '_id'> {
  _id: string
  environment: 'sandbox' | 'production'
  nextIcv: number
  lastAcceptedHash: string
  lockOwner?: string | null
  lockExpiresAt?: Date | null
  updatedAt?: Date
}

const zatcaChainStateSchema = new Schema<IZatcaChainState>(
  {
    _id: { type: String, required: true },
    environment: {
      type: String,
      enum: ['sandbox', 'production'],
      required: true,
    },
    nextIcv: { type: Number, required: true, default: 1 },
    lastAcceptedHash: { type: String, required: true },
    lockOwner: { type: String, default: null },
    lockExpiresAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

export const ZatcaChainState =
  (models.ZatcaChainState as Model<IZatcaChainState>) ||
  model<IZatcaChainState>('ZatcaChainState', zatcaChainStateSchema)

