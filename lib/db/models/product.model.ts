import { Document, Model, model, models, Schema } from 'mongoose'
import { IProductInput } from '@/types'

import { RETURN_POLICIES } from '@/lib/returns/policy'

// createdAt: Date and updatedAt: Date, will be added by Mongoose anyway, but defining it here so  TypeScript would complain if you tried to access those properties on a product document.
export interface IProductVariant {
  id: string
  sku: string
  size: string
  color: string
  price: number
  listPrice: number
  countInStock: number
  image: string
  barcode: string
  weight: number
  isDefault: boolean
}

export interface IProduct extends Omit<Document, '_id'>, IProductInput {
  _id: string
  createdAt: Date
  updatedAt: Date
}

//  The Schema is the blueprint for your data. It defines the structure, types, validation, and default values for the documents that will be stored in a MongoDB collection. Think of it as defining the "shape" of your data.

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    category: {
      type: String,
      required: true,
    },
    images: [String],
    brand: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    listPrice: {
      type: Number,
      required: true,
    },
    countInStock: {
      type: Number,
      required: true,
    },
    tags: { type: [String], default: ['new arrival'] },
    colors: { type: [String], default: ['White', 'Red', 'Black'] },
    sizes: { type: [String], default: ['60'] },
    variants: [
      {
        _id: false,
        id: { type: String, required: true },
        sku: { type: String, required: true },
        size: { type: String, default: '' },
        color: { type: String, default: '' },
        price: { type: Number, required: true },
        listPrice: { type: Number, required: true, default: 0 },
        countInStock: { type: Number, required: true, default: 0 },
        image: { type: String, default: '' },
        barcode: { type: String, default: '' },
        weight: { type: Number, default: 0 },
        isDefault: { type: Boolean, default: false },
      },
    ],
    avgRating: {
      type: Number,
      required: true,
      default: 0,
    },
    numReviews: {
      type: Number,
      required: true,
      default: 0,
    },
    ratingDistribution: [
      {
        rating: {
          type: Number,
          required: true,
        },
        count: {
          type: Number,
          required: true,
        },
      },
    ],
    numSales: {
      type: Number,
      required: true,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      required: true,
      default: false,
    },
    taxCategory: {
      type: String,
      enum: ['S', 'Z', 'E', 'O'],
      required: true,
      default: 'S',
    },
    exemptionReasonCode: { type: String, default: '' },
    returnPolicy: {
      type: String,
      enum: RETURN_POLICIES,
      required: true,
      default: 'return_and_refund',
    },
    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Review',
        default: [],
      },
    ],
  },
  {
    timestamps: true,
  }
)

const Product =
  (models.Product as Model<IProduct>) ||
  model<IProduct>('Product', productSchema)

export default Product

/*
after any change run :
 * npm run seed
-------------------
 Purpose: models is an object in Mongoose that acts as a cache for your defined models.
 ? here either store inside Product the cached models.Product or store a new value by creating a new model w take two values(NewModelName, SchemaToMatchTo)
  model() is function to create new schema
 ? Model ==> M capital is a Typescript type of the model you will create, can edit documents as a whole and edit them, can create new documents.
  Document ==> is also a Typescript type but for an actual document and can edit the specific info(objects)inside them.
  IProductInput (and the Zod schema it's based on) is for validating and preparing data before it's sent to Mongoose.
 ? productSchema is for defining how Mongoose should store and manage the data in MongoDB.
  TypeScript interfaces and Mongoose schemas serve different purposes, and Mongoose needs explicit schema definitions to properly store and manage data in MongoDB. The IProduct interface helps with type safety, but it doesn't replace the need for defining the schema itself.
 ? The IProduct interface combines the structure of input data (IProductInput) with the structure of the database document (including MongoDB-specific properties).

  timestamps: true tells Mongoose to automatically manage the createdAt and updatedAt properties.
 ? Defining createdAt and updatedAt in the IProduct interface ensures that the interface is complete, provides type safety, and makes the code self-documenting. They all play different but crucial roles.
*/
