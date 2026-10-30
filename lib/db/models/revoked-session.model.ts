import { Document, Model, model, models, Schema } from 'mongoose'

export interface IRevokedSession extends Omit<Document, '_id'> {
  _id: string
  sid: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

// Node-side mirror of the Redis session denylist. The TTL index removes rows
// when the revoked token would have expired anyway, so the collection stays
// bounded without a cleanup job.
const revokedSessionSchema = new Schema<IRevokedSession>(
  {
    sid: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
)

const RevokedSession =
  (models.RevokedSession as Model<IRevokedSession>) ||
  model<IRevokedSession>('RevokedSession', revokedSessionSchema)

export default RevokedSession
