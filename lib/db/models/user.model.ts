import { IUserInput } from '@/types'
import {
  Document,
  // InferSchemaType,
  Model,
  model,
  models,
  Schema,
} from 'mongoose'

export interface IUser extends Document, IUserInput {
  _id: string
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    password: { type: String },
    image: { type: String },
    emailVerified: { type: Date, default: null },
    verificationToken: { type: String, default: null },
    verificationTokenExpires: { type: Date, default: null }
  },
  {
    timestamps: true,
  }
)
// if you make a Schema before use it , if not make a new Schema "Schema = Blueprint"
const User = (models.User as Model<IUser>) || model<IUser>('User', userSchema)

export default User

// creating a schema for DB to store User on its Types and checks.
