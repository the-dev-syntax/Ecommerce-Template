import { ISettingInput } from '@/types'
import { Document, Model, model, models, Schema } from 'mongoose'

export interface ISetting extends Omit<Document, '_id'>, ISettingInput {
  _id: string
  createdAt: Date
  updatedAt: Date
}

const settingSchema = new Schema<ISetting>(
  {
    market: {
      type: String,
      enum: ['SA', 'US', 'CA'],
      required: true,
      default: 'SA',
    },
    brand: {
      logoDark: { type: String, default: '' },
      favicon: { type: String, default: '' },
      emailLogo: { type: String, default: '' },
      primaryColor: { type: String, default: '#eab308' },
      accentColor: { type: String, default: '#0ea5e9' },
      fontFamily: { type: String, default: 'geist' },
      socialLinks: [
        {
          _id: false,
          name: { type: String, required: true },
          url: { type: String, required: true },
        },
      ],
    },
    seo: {
      titleTemplate: { type: String, default: '%s | Essential Vital' },
      defaultDescription: { type: String, default: '' },
      ogImage: { type: String, default: '/og-preview.jpg' },
      twitterHandle: { type: String, default: '' },
    },
    features: {
      reviews: { type: Boolean, required: true, default: true },
      browsingHistory: { type: Boolean, required: true, default: true },
      cashOnDelivery: { type: Boolean, required: true, default: true },
    },
    navigation: {
      header: [
        {
          _id: false,
          name: { type: String, required: true },
          href: { type: String, required: true },
        },
      ],
      footer: [
        {
          _id: false,
          title: { type: String, required: true },
          links: [
            {
              _id: false,
              name: { type: String, required: true },
              href: { type: String, required: true },
            },
          ],
        },
      ],
    },
    email: {
      senderName: { type: String, default: '' },
      senderEmail: { type: String, default: '' },
      replyTo: { type: String, default: '' },
    },
    seller: {
      legalNameEn: {
        type: String,
        required: true,
        default: 'NAKAA ELSEHA MEDICAL PHARMACY',
      },
      legalNameAr: {
        type: String,
        required: true,
        default: 'صيدلية نقاء الصحة الطبية',
      },
      vatNumber: { type: String, required: true, default: '310161142300003' },
      crNumber: { type: String, default: '1185102259' },
      nationalAddress: { type: String, default: 'RFKB4744' },
      street: { type: String, required: true, default: 'King Fahd Road' },
      buildingNumber: { type: String, required: true, default: '1234' },
      citySubdivision: {
        type: String,
        required: true,
        default: 'Al Olaya',
      },
      city: { type: String, required: true, default: 'Riyadh' },
      postalCode: { type: String, required: true, default: '12211' },
      country: { type: String, required: true, default: 'SA' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    invoice: {
      prefix: { type: String, required: true, default: 'NEM' },
      sequenceLength: { type: Number, required: true, default: 6 },
    },
    common: {
      pageSize: { type: Number, required: true, default: 9 },
      isMaintenanceMode: { type: Boolean, required: true, default: false },
      freeShippingMinPrice: { type: Number, required: true, default: 0 },
      taxRate: { type: Number, required: true, default: 0.15 },
      taxInclusive: { type: Boolean, required: true, default: true },
      defaultTheme: { type: String, required: true, default: 'light' },
      defaultColor: { type: String, required: true, default: 'gold' },
    },
    site: {
      name: { type: String, required: true },
      url: { type: String, required: true },
      logo: { type: String, required: true },
      slogan: { type: String, required: true },
      description: { type: String, required: true },
      keywords: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      author: { type: String, required: true },
      copyright: { type: String, required: true },
      address: { type: String, required: true },
    },
    carousels: [
      {
        title: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
          unique: true,
        },
        image: {
          type: String,
          required: true,
        },
        buttonCaption: {
          type: String,
          required: true,
        },
      },
    ],
    availableLanguages: [
      {
        name: {
          type: String,
          required: true,
          set: (value: string) => Buffer.from(value).toString('utf8'),
        },
        code: { type: String, required: true },
      },
    ],
    defaultLanguage: { type: String, required: true },
    availableCurrencies: [
      {
        name: {
          type: String,
          required: true,
          set: (value: string) => Buffer.from(value).toString('utf8'),
        },
        code: { type: String, required: true },
        convertRate: { type: Number, required: true },
        symbol: {
          type: String,
          required: true,
          set: (value: string) => Buffer.from(value).toString('utf8'),
        },
      },
    ],
    defaultCurrency: { type: String, required: true },
    availablePaymentMethods: [
      {
        name: { type: String, required: true },
        commission: { type: Number, required: true, default: 0 },
      },
    ],
    defaultPaymentMethod: { type: String, required: true },
    availableDeliveryDates: [
      {
        name: { type: String, required: true },
        daysToDeliver: { type: Number, required: true },
        shippingPrice: { type: Number, required: true },
        freeShippingMinPrice: { type: Number, required: true },
      },
    ],
    defaultDeliveryDate: { type: String, required: true },
  },
  {
    timestamps: true,
  }
)

const Setting =
  (models.Setting as Model<ISetting>) ||
  model<ISetting>('Setting', settingSchema)

export default Setting