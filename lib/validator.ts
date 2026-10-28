import { z } from 'zod'
import { formatNumberWithDecimal } from './utils'

import {
  REFUND_REASONS,
  RETURN_POLICIES,
} from './returns/policy'


const MongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid MongoDB ID' })

// Common validation for price
// const Price = (field: string) =>z.coerce.number().refine((value) => /^\d+(\.\d{2})?$/.test(formatNumberWithDecimal(value)), or give error
const Price = (field: string) =>
  z.coerce
    .number()
    .refine(
      (value) => /^\d+(\.\d{2})?$/.test(formatNumberWithDecimal(value)),
      `${field} must have exactly two decimal places (e.g., 49.99)`
    )

// Review Schema , MongoId declared above.
export const ReviewInputSchema = z.object({
  product: MongoId,
  user: MongoId,
  isVerifiedPurchase: z.boolean(),
  title: z.string().min(1, 'Title is required').max(120, 'Title is too long'),
  comment: z
    .string()
    .min(1, 'Comment is required')
    .max(3000, 'Comment is too long'),
  rating: z.coerce
    .number()
    .int()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
})


// product eschema , z.coarse ==>convert.
export const ProductVariantSchema = z.object({
  id: z.string().min(1, 'Variant id is required').max(100),
  sku: z.string().min(1, 'SKU is required').max(100),
  size: z.string().max(50),
  color: z.string().max(50),
  price: Price('Variant price'),
  listPrice: Price('Variant list price'),
  countInStock: z.coerce
    .number()
    .int()
    .nonnegative('Variant stock must be a non-negative number'),
  image: z.string().max(2048),
  barcode: z.string().max(100),
  weight: z.coerce.number().nonnegative('Weight must be non-negative'),
  isDefault: z.boolean(),
})

export const ProductInputSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters'),
  category: z.string().min(1, 'Category is required'),
  images: z.array(z.string()).min(1, 'Product must have at least one image'),
  brand: z.string().min(1, 'Brand is required'),
  description: z.string().min(1, 'Description is required'),
  isPublished: z.boolean(),
  taxCategory: z.enum(['S', 'Z', 'E', 'O']).optional(),
  exemptionReasonCode: z.string().max(10).optional(),
  returnPolicy: z.enum(RETURN_POLICIES).optional(),
  price: Price('Price'),
  listPrice: Price('List price'),
  countInStock: z.coerce
    .number()
    .int()
    .nonnegative('count in stock must be a non-negative number'),
  lowStockThreshold: z.coerce
    .number()
    .int()
    .nonnegative('low stock threshold must be a non-negative number')
    .optional(),
  tags: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  variants: z.array(ProductVariantSchema).optional(),
  avgRating: z.coerce
    .number()
    .min(0, 'Average rating must be at least 0')
    .max(5, 'Average rating must be at most 5'),
  numReviews: z.coerce
    .number()
    .int()
    .nonnegative('Number of reviews must be a non-negative number'),
  ratingDistribution: z
    .array(z.object({ rating: z.number(), count: z.number() }))
    .max(5),
  reviews: z.array(ReviewInputSchema).default([]),
  numSales: z.coerce
    .number()
    .int()
    .nonnegative('Number of sales must be a non-negative number'),
})

// updating an existing product
export const ProductUpdateSchema = ProductInputSchema.extend({
  _id: z.string(),
})


// One Item to add, Schema
export const OrderItemSchema = z.object({
  clientId: z
    .string()
    .min(1, 'clientId is required')
    .max(100, 'clientId is too long'), //unique id for specific instance of an item being added to an order or cart, generated each time.
  product: MongoId,
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  slug: z.string().min(1, 'Slug is required').max(200, 'Slug is too long'), // URL generation, SEO, human-readable ID , fixed name 
  category: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category is too long'),
  quantity: z
    .number()
    .int()
    .positive('Quantity must be at least 1'),
  countInStock: z
    .number()
    .int()
    .nonnegative('Count in stock must be a non-negative number'),
  image: z
    .string()
    .min(1, 'Image is required')
    .max(2048, 'Image URL is too long'),
  price: Price('Price'),
  taxCategory: z.enum(['S', 'Z', 'E', 'O']).optional(),
  exemptionReasonCode: z.string().max(10).optional(),
  returnPolicy: z.enum(RETURN_POLICIES).optional(),
  netPrice: z.number().optional(),
  vatAmount: z.number().optional(),
  vatPercent: z.number().optional(),
  refundedQuantity: z.coerce.number().int().nonnegative().optional(),
  restockedQuantity: z.coerce.number().int().nonnegative().optional(),
  size: z.string().max(50, 'Size is too long').optional(),
  color: z.string().max(50, 'Color is too long').optional(),
  variantId: z.string().max(100).optional(),
  sku: z.string().max(100).optional(),
  variantLabel: z.string().max(200).optional(),
  weight: z.coerce.number().nonnegative().optional(),
})

export const ShippingAddressSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(100, 'Full name is too long'),
  street: z
    .string()
    .min(1, 'Address is required')
    .max(200, 'Address is too long'),
  city: z.string().min(1, 'City is required').max(100, 'City is too long'),
  postalCode: z
    .string()
    .min(1, 'Postal code is required')
    .max(20, 'Postal code is too long'),
  province: z
    .string()
    .min(1, 'Province is required')
    .max(100, 'Province is too long'),
  district: z.string().max(100, 'District is too long').optional(),
  nationalAddress: z
    .string()
    .max(20, 'National address is too long')
    .optional(),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .max(30, 'Phone number is too long'),
  country: z
    .string()
    .min(1, 'Country is required')
    .max(100, 'Country is too long'),
})

// place order page
export const OrderInputSchema = z.object({
  user: MongoId,
  items: z
    .array(OrderItemSchema)
    .min(1, 'Order must contain at least one item')
    .max(50, 'Order cannot contain more than 50 items'),
  shippingAddress: ShippingAddressSchema,
  paymentMethod: z.string().min(1, 'Payment method is required'),
  currency: z.string().min(3).max(3),
  paymentResult: z
    .object({
      id: z.string(),
      status: z.string(),
      email_address: z.string(),
      pricePaid: z.string(),
    })
    .optional(),
  itemsPrice: Price('Items price'),
  shippingPrice: Price('Shipping price'),
  taxPrice: Price('Tax price'),
  totalPrice: Price('Total price'),
  taxInclusive: z.boolean().default(true),
  taxRate: z.coerce.number().min(0).max(1).default(0.15),
  shippingRateId: z.string().optional(),
  shippingZone: z.string().optional(),
  shippingCarrier: z.string().optional(),
  shippingService: z.string().optional(),
  shippingEtaMin: z.coerce.number().optional(),
  shippingEtaMax: z.coerce.number().optional(),
  isPickup: z.boolean().optional(),
  pickupLocation: z.string().optional(),
  codFee: z.coerce.number().optional(),
  expectedDeliveryDate: z
    .date()
    .refine(
      (value) => value > new Date(),
      'Expected delivery date must be in the future'
    ),
  isDelivered: z.boolean().default(false),
  deliveredAt: z.date().optional(),
  isPaid: z.boolean().default(false),
  paidAt: z.date().optional(),
  // Stripe Step 1 intent ID — stored so Step 2 can verify & reuse it
  stripePaymentIntentId: z.string().optional(),
})

// the whole cart Schema
export const CartSchema = z.object({
  items: z
    .array(OrderItemSchema)
    .min(1, 'Order must contain at least one item')
    .max(50, 'Cart cannot contain more than 50 items'),
  itemsPrice: z.number(),
  taxPrice: z.optional(z.number()),
  shippingPrice: z.optional(z.number()),
  totalPrice: z.number(),
  taxInclusive: z.optional(z.boolean()),
  taxRate: z.optional(z.number()),
  shippingRateId: z.optional(z.string()),
  shippingZone: z.optional(z.string()),
  shippingCarrier: z.optional(z.string()),
  shippingService: z.optional(z.string()),
  shippingEtaMin: z.optional(z.number()),
  shippingEtaMax: z.optional(z.number()),
  isPickup: z.optional(z.boolean()),
  pickupLocation: z.optional(z.string()),
  codFee: z.optional(z.number()),
  paymentMethod: z.optional(z.string()),
  shippingAddress: z.optional(ShippingAddressSchema),
  deliveryDateIndex: z.optional(z.number()),
  availableDeliveryDates: z
    .array(
      z.object({
        name: z.string(),
        daysToDeliver: z.number(),
        shippingPrice: z.number(),
        freeShippingMinPrice: z.number(),
      })
    )
    .optional(),
  expectedDeliveryDate: z.optional(z.date()),
})

// Return/refund selection submitted by an admin.
export const OrderReturnSelectionSchema = z.object({
  clientId: z.string().min(1, 'Item id is required').max(100),
  quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
})

export const OrderReturnInputSchema = z.object({
  orderId: MongoId,
  selections: z
    .array(OrderReturnSelectionSchema)
    .min(1, 'Select at least one item')
    .max(50, 'Too many selected items'),
  reason: z.enum(REFUND_REASONS),
  policyOverrideReason: z
    .string()
    .max(500, 'Override reason is too long')
    .optional(),
  manualReference: z
    .string()
    .max(200, 'Refund reference is too long')
    .optional(),
  idempotencyKey: z
    .string()
    .min(8, 'Invalid request key')
    .max(100, 'Invalid request key'),
  forceManual: z.boolean().optional(),
})

// USER
const UserName = z
  .string()
  .min(2, { message: 'Username must be at least 2 characters' })
  .max(50, { message: 'Username must be at most 50 characters' })
const Email = z
  .string()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .email('Email is invalid')
// const Password = z.string().min(6, 'Password must be at least 6 characters')
const UserRole = z.enum(['user', 'admin']);

const Password = z.string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const UserInputSchema = z.object({
  name: UserName,
  email: Email,
  image: z.string().optional(),
  emailVerified: z.date().nullable(),
  verificationToken: z.string().nullable().optional(),
  verificationTokenExpires: z.date().nullable().optional(),
  role: UserRole,
  password: Password,
  paymentMethod: z.string().min(1, 'Payment method is required'),
  address: z.object({
    fullName: z.string().min(1, 'Full name is required'),
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    province: z.string().min(1, 'Province is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().min(1, 'Country is required'),
    phone: z.string().min(1, 'Phone number is required'),
  }),
})

// Sign-in must not re-apply the current password policy: accounts created
// before a policy change (or long passwords added before the 72-char cap)
// would otherwise be locked out. Only reject empty/impossibly long values.
const SignInPassword = z.string().min(1, 'Password is required').max(256)

export const UserSignInSchema = z.object({
  email: Email,
  password: SignInPassword,
  callbackUrl: z.string().optional(),
}).strip()

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: Password,
    confirmPassword: Password,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  })

export const RequestPasswordResetSchema = z.object({
  email: Email,
})

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: Password,
    confirmPassword: Password,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export const UserSignUpSchema = UserSignInSchema.extend({
  name: UserName,
  password: Password,
  confirmPassword: Password,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export const UserNameSchema = z.object({
  name: UserName,
})



export const UserUpdateSchema = z.object({
  _id: MongoId,
  name: UserName,
  email: Email,
  role: UserRole,
  emailVerified: z.date().nullable(), 
})


export const ProductInputFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters'),
  category: z.string().min(1, 'Category is required'),
  images: z.array(z.string()).min(1, 'Product must have at least one image'),
  brand: z.string().min(1, 'Brand is required'),
  description: z.string().min(1, 'Description is required'),
  isPublished: z.boolean(),
  taxCategory: z.enum(['S', 'Z', 'E', 'O']).optional(),
  exemptionReasonCode: z.string().max(10).optional(),
  returnPolicy: z.enum(RETURN_POLICIES).optional(),
  price: Price('Price'),
  listPrice: Price('List price'),
  countInStock: z.coerce
    .number()
    .int()
    .nonnegative('count in stock must be a non-negative number'),
  lowStockThreshold: z.coerce
    .number()
    .int()
    .nonnegative('low stock threshold must be a non-negative number')
    .optional(),
  tags: z.array(z.string()),
  sizes: z.array(z.string()),
  colors: z.array(z.string()),
  variants: z.array(ProductVariantSchema).optional(),
  avgRating: z.coerce
    .number()
    .min(0, 'Average rating must be at least 0')
    .max(5, 'Average rating must be at most 5'),
  numReviews: z.coerce
    .number()
    .int()
    .nonnegative('Number of reviews must be a non-negative number'),
  ratingDistribution: z
    .array(z.object({ rating: z.number(), count: z.number() }))
    .max(5),
  reviews: z.array(ReviewInputSchema),
  numSales: z.coerce
    .number()
    .int()
    .nonnegative('Number of sales must be a non-negative number'),
})

export const ProductUpdateFormSchema = ProductInputFormSchema.extend({
  _id: z.string()
})



export const WebPageInputSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters'),
  content: z.string().min(1, 'Content is required'),
  isPublished: z.boolean(),
})

export const WebPageUpdateSchema = WebPageInputSchema.extend({
  _id: z.string(),
})

// Setting

export const SiteLanguageSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
})
export const CarouselSchema = z.object({
  title: z.string().min(1, 'title is required'),
  url: z.string().min(1, 'url is required'),
  image: z.string().min(1, 'image is required'),
  buttonCaption: z.string().min(1, 'buttonCaption is required'),
})

export const SiteCurrencySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(3).max(3, 'Use a three-letter currency code'),
  convertRate: z.coerce.number().min(0, 'Convert rate must be at least 0'),
  locale: z.string().min(2, 'Locale is required').max(20),
  decimals: z.coerce.number().int().min(0).max(4),
  isBase: z.boolean(),
  symbol: z.string().min(1, 'Symbol is required'),
})

export const PaymentMethodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  commission: z.coerce.number().min(0, 'Commission must be at least 0'),
})

export const ShippingRateSchema = z.object({
  zoneName: z.string().min(1, 'Zone name is required').max(100),
  country: z.string().min(2).max(100),
  region: z.string().min(1, 'Region is required').max(100),
  city: z.string().min(1, 'City is required').max(100),
  carrier: z.string().min(1, 'Carrier is required').max(100),
  serviceName: z.string().min(1, 'Service is required').max(100),
  baseRate: z.coerce.number().min(0),
  includedWeightKg: z.coerce.number().min(0),
  extraPerKg: z.coerce.number().min(0),
  weightRoundingKg: z.coerce.number().min(0.1),
  freeShippingEnabled: z.boolean().default(true),
  freeShippingMinPrice: z.coerce.number().min(0),
  codFee: z.coerce.number().min(0),
  remoteSurcharge: z.coerce.number().min(0),
  etaMinDays: z.coerce.number().int().min(0),
  etaMaxDays: z.coerce.number().int().min(0),
  pickupAvailable: z.boolean(),
  codAvailable: z.boolean(),
  isActive: z.boolean(),
  priority: z.coerce.number().int(),
})

export const ShippingRateUpdateSchema = ShippingRateSchema.extend({
  _id: z.string(),
})

export const DeliveryDateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  daysToDeliver: z.number().min(0, 'Days to deliver must be at least 0'),
  shippingPrice: z.coerce.number().min(0, 'Shipping price must be at least 0'),
  freeShippingMinPrice: z.coerce
    .number()
    .min(0, 'Free shipping min amount must be at least 0'),
})

export const SellerSchema = z.object({
  legalNameEn: z.string().min(1, 'English legal name is required'),
  legalNameAr: z.string().min(1, 'Arabic legal name is required'),
  vatNumber: z.string().min(1, 'VAT number is required'),
  crNumber: z.string(),
  nationalAddress: z.string(),
  street: z.string().min(1, 'Street is required'),
  buildingNumber: z.string().min(1, 'Building number is required'),
  citySubdivision: z.string().min(1, 'District is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(2),
  email: z.string(),
  phone: z.string(),
})

export const InvoiceSettingsSchema = z.object({
  prefix: z
    .string()
    .min(1, 'Invoice prefix is required')
    .max(10, 'Invoice prefix is too long')
    .regex(/^[A-Z0-9-]+$/, 'Use uppercase letters, numbers, or dashes'),
  sequenceLength: z.coerce
    .number()
    .int()
    .min(4, 'Sequence length must be at least 4')
    .max(10, 'Sequence length must be at most 10'),
})

export const MarketSchema = z.enum(['SA', 'US', 'CA']).default('SA')

const SocialLinkSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name is too long'),
  url: z.string().min(1, 'Url is required').max(2048, 'Url is too long'),
})

const MenuLinkSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  href: z.string().min(1, 'Link is required').max(2048, 'Link is too long'),
})

export const BrandSettingsSchema = z.object({
  logoDark: z.string().max(2048),
  favicon: z.string().max(2048),
  emailLogo: z.string().max(2048),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour'),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour'),
  fontFamily: z.enum(['geist', 'cairo', 'system', 'serif']),
  socialLinks: z.array(SocialLinkSchema).max(20),
})

export const SeoSettingsSchema = z.object({
  titleTemplate: z.string().max(200),
  defaultDescription: z.string().max(500),
  ogImage: z.string().max(2048),
  twitterHandle: z.string().max(50),
})

export const FeatureFlagsSchema = z.object({
  reviews: z.boolean(),
  browsingHistory: z.boolean(),
  cashOnDelivery: z.boolean(),
})

export const NavigationSettingsSchema = z.object({
  header: z.array(MenuLinkSchema).max(30),
  footer: z
    .array(
      z.object({
        title: z.string().min(1, 'Title is required').max(100),
        links: z.array(MenuLinkSchema).max(20),
      })
    )
    .max(8),
})

export const EmailSettingsSchema = z.object({
  senderName: z.string().max(100),
  senderEmail: z.string().max(254),
  replyTo: z.string().max(254),
})

const EmailTemplateSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  heading: z.string().max(200),
  intro: z.string().max(2000),
  footer: z.string().max(1000),
})

export const EmailTemplatesSchema = z.object({
  receipt: EmailTemplateSchema,
  review: EmailTemplateSchema,
  reset: EmailTemplateSchema,
  verification: EmailTemplateSchema,
})

export const SettingInputSchema = z.object({
  // PROMPT: create fields
  // codeium, based on the mongoose schema for settings
  market: MarketSchema,
  brand: BrandSettingsSchema,
  seo: SeoSettingsSchema,
  features: FeatureFlagsSchema,
  navigation: NavigationSettingsSchema,
  email: EmailSettingsSchema,
  emailTemplates: EmailTemplatesSchema,
  seller: SellerSchema,
  invoice: InvoiceSettingsSchema,
  common: z.object({
    pageSize: z.coerce
      .number()
      .min(1, 'Page size must be at least 1')
      .default(9),
    isMaintenanceMode: z.boolean().default(false),
    freeShippingMinPrice: z.coerce
      .number()
      .min(0, 'Free shipping min price must be at least 0')
      .default(0),
    taxRate: z.coerce
      .number()
      .min(0, 'Tax rate must be at least 0')
      .max(1, 'Tax rate must be at most 1 (e.g. 0.15 = 15%)')
      .default(0.15),
    taxInclusive: z.boolean().default(true),
    defaultTheme: z
      .string()
      .min(1, 'Default theme is required')
      .default('light'),
    defaultColor: z
      .string()
      .min(1, 'Default color is required')
      .default('gold'),
  }),
  site: z.object({
    name: z.string().min(1, 'Name is required'),
    logo: z.string().min(1, 'logo is required'),
    slogan: z.string().min(1, 'Slogan is required'),
    description: z.string().min(1, 'Description is required'),
    keywords: z.string().min(1, 'Keywords is required'),
    url: z.string().min(1, 'Url is required'),
    email: z.string().min(1, 'Email is required'),
    phone: z.string().min(1, 'Phone is required'),
    author: z.string().min(1, 'Author is required'),
    copyright: z.string().min(1, 'Copyright is required'),
    address: z.string().min(1, 'Address is required'),
  }),
  availableLanguages: z
    .array(SiteLanguageSchema)
    .min(1, 'At least one language is required'),

  carousels: z
    .array(CarouselSchema)
    .min(1, 'At least one language is required'),
  defaultLanguage: z.string().min(1, 'Language is required'),
  availableCurrencies: z
    .array(SiteCurrencySchema)
    .min(1, 'At least one currency is required'),
  defaultCurrency: z.string().min(1, 'Currency is required'),
  availablePaymentMethods: z
    .array(PaymentMethodSchema)
    .min(1, 'At least one payment method is required'),
  defaultPaymentMethod: z.string().min(1, 'Payment method is required'),
  availableDeliveryDates: z
    .array(DeliveryDateSchema)
    .min(1, 'At least one delivery date is required'),
  defaultDeliveryDate: z.string().min(1, 'Delivery date is required'),
})
export const SettingInputSchemaNoDefaults = z.object({
  // PROMPT: create fields
  // codeium, based on the mongoose schema for settings
  market: z.enum(['SA', 'US', 'CA']),
  brand: BrandSettingsSchema,
  seo: SeoSettingsSchema,
  features: FeatureFlagsSchema,
  navigation: NavigationSettingsSchema,
  email: EmailSettingsSchema,
  emailTemplates: EmailTemplatesSchema,
  seller: SellerSchema,
  invoice: InvoiceSettingsSchema,
  common: z.object({
    pageSize: z.coerce
      .number()
      .min(1, 'Page size must be at least 1')
      ,
    isMaintenanceMode: z.boolean(),
    freeShippingMinPrice: z.coerce
      .number()
      .min(0, 'Free shipping min price must be at least 0')
      ,
    taxRate: z.coerce
      .number()
      .min(0, 'Tax rate must be at least 0')
      .max(1, 'Tax rate must be at most 1 (e.g. 0.15 = 15%)'),
    taxInclusive: z.boolean(),
    defaultTheme: z
      .string()
      .min(1, 'Default theme is required')
      ,
    defaultColor: z
      .string()
      .min(1, 'Default color is required')
      ,
  }),
  site: z.object({
    name: z.string().min(1, 'Name is required'),
    logo: z.string().min(1, 'logo is required'),
    slogan: z.string().min(1, 'Slogan is required'),
    description: z.string().min(1, 'Description is required'),
    keywords: z.string().min(1, 'Keywords is required'),
    url: z.string().min(1, 'Url is required'),
    email: z.string().min(1, 'Email is required'),
    phone: z.string().min(1, 'Phone is required'),
    author: z.string().min(1, 'Author is required'),
    copyright: z.string().min(1, 'Copyright is required'),
    address: z.string().min(1, 'Address is required'),
  }),
  availableLanguages: z
    .array(SiteLanguageSchema)
    .min(1, 'At least one language is required'),

  carousels: z
    .array(CarouselSchema)
    .min(1, 'At least one language is required'),
  defaultLanguage: z.string().min(1, 'Language is required'),
  availableCurrencies: z
    .array(SiteCurrencySchema)
    .min(1, 'At least one currency is required'),
  defaultCurrency: z.string().min(1, 'Currency is required'),
  availablePaymentMethods: z
    .array(PaymentMethodSchema)
    .min(1, 'At least one payment method is required'),
  defaultPaymentMethod: z.string().min(1, 'Payment method is required'),
  availableDeliveryDates: z
    .array(DeliveryDateSchema)
    .min(1, 'At least one delivery date is required'),
  defaultDeliveryDate: z.string().min(1, 'Delivery date is required'),
})

export const UserEmailSchema = z.object({
  email: Email
})