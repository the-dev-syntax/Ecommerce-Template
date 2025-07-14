import { IWebPageInput } from '@/types'
import {
  Document,
  Model,
  model,
  models,
  Schema,
} from 'mongoose'

export interface IWebPage extends Document, IWebPageInput {
  _id: string
  createdAt: Date
  updatedAt: Date
}

const webPageSchema = new Schema<IWebPage>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: { type: String, required: true, default: 'Content goes here' },
    isPublished: { type: Boolean, required: true, default: false },
  },
  {
    timestamps: true,
  }
)

// if you make a Schema before use it , if not make a new Schema "Schema = Blueprint"
const WebPage = (models.WebPage as Model<IWebPage>) || model<IWebPage>('WebPage', webPageSchema)

export default WebPage