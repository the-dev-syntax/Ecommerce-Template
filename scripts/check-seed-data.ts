// Mirrors the development generation in lib/db/seed.ts. Keep the two in sync
// when changing seed order/review construction.
import mongoose from 'mongoose'

import data from '../lib/data'
import Product from '../lib/db/models/product.model'
import Review from '../lib/db/models/review.model'
import Setting from '../lib/db/models/setting.model'
import User from '../lib/db/models/user.model'
import WebPage from '../lib/db/models/web-page.model'
import Order from '../lib/db/models/order.model'
import { normalizeProductVariants } from '../lib/product-variants'
import { priceOrderItems } from '../lib/tax'
import { calculatePastDate, generateId, round2 } from '../lib/utils'
import type { OrderItem, ShippingAddress } from '../types'

const problems: string[] = []
const settings = data.settings[0]

function validate(label: string, document: { validateSync: () => Error | null }) {
  const error = document.validateSync()
  if (error) problems.push(`${label}: ${error.message}`)
}

function duplicates(values: string[]) {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

// ---------------------------------------------------------------------------
// Settings, pages and users
// ---------------------------------------------------------------------------
validate('settings', new Setting(settings))

for (const [index, page] of data.webPages.entries()) {
  validate(`webPage[${index}]`, new WebPage(page))
}

const userDocs = data.users.map((user, index) => {
  const doc = new User({ ...user, _id: new mongoose.Types.ObjectId() })
  validate(`user[${index}] (${user.email})`, doc)
  return doc
})

const seedUsers = data.users as unknown as Array<
  (typeof data.users)[number] & {
    phone: string
    addresses: Array<{ id: string; isDefault?: boolean }>
  }
>

for (const [index, user] of seedUsers.entries()) {
  if (user.address.country !== 'SA')
    problems.push(`user[${index}].address.country is not SA`)
  if (!user.phone.startsWith('+966'))
    problems.push(`user[${index}].phone is not +966`)
  if ((user.addresses ?? []).length < 2)
    problems.push(`user[${index}] has fewer than two saved addresses`)
  const defaults = (user.addresses ?? []).filter((address) => address.isDefault)
  if (defaults.length !== 1)
    problems.push(`user[${index}] must have exactly one default address`)
  if (!user.emailVerified)
    problems.push(`user[${index}].emailVerified is not set`)
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
const productDocs = data.products.map((product, index) => {
  const normalized = normalizeProductVariants(product)
  const doc = new Product({
    ...normalized,
    _id: new mongoose.Types.ObjectId(),
  })
  validate(`product[${index}] (${product.slug})`, doc)
  return doc.toObject() as unknown as Record<string, any>
})

for (const [index, product] of productDocs.entries()) {
  const variants = (product.variants ?? []) as Array<{
    id: string
    sku: string
    price: number
    listPrice: number
    countInStock: number
    isDefault?: boolean
  }>
  const defaults = variants.filter((variant) => variant.isDefault)
  if (defaults.length !== 1)
    problems.push(`product[${index}] must have exactly one default variant`)
  const stock = variants.reduce((total, variant) => total + variant.countInStock, 0)
  if (stock !== product.countInStock)
    problems.push(`product[${index}] variant stock does not sum to countInStock`)
  if (defaults[0]) {
    if (product.price !== defaults[0].price)
      problems.push(`product[${index}] price differs from its default variant`)
    if (product.listPrice !== defaults[0].listPrice)
      problems.push(`product[${index}] listPrice differs from its default variant`)
  }
}

// ---------------------------------------------------------------------------
// Orders: same construction as lib/db/seed.ts, but with in-memory products.
// ---------------------------------------------------------------------------
type SeedOrder = ReturnType<typeof buildOrder>

function toOrderItem(product: Record<string, any>, quantity: number) {
  const variant =
    product.variants?.find(
      (candidate: { isDefault?: boolean }) => candidate.isDefault
    ) ?? product.variants?.[0]

  return {
    clientId: generateId(),
    product: product._id,
    name: product.name,
    slug: product.slug,
    quantity,
    image: variant?.image || product.images?.[0] || '',
    category: product.category,
    price: variant?.price ?? product.price,
    countInStock: variant?.countInStock ?? product.countInStock,
    size: variant?.size || undefined,
    color: variant?.color || undefined,
    variantId: variant?.id,
    sku: variant?.sku,
    variantLabel: variant
      ? [variant.size, variant.color].filter(Boolean).join(' / ')
      : undefined,
    weight: variant?.weight || product.weight || 0,
    taxCategory: product.taxCategory ?? 'S',
    exemptionReasonCode: product.exemptionReasonCode ?? '',
    returnPolicy: product.returnPolicy ?? 'return_and_refund',
    refundedQuantity: 0,
    restockedQuantity: 0,
  }
}

function priceSeedOrder(items: OrderItem[], deliveryDateIndex: number) {
  const {
    availableDeliveryDates,
    common: { taxRate, taxInclusive },
  } = settings
  const pricedItems = priceOrderItems(items, taxRate, taxInclusive)
  const itemsPrice = round2(
    pricedItems.reduce((total, item) => total + item.price * item.quantity, 0)
  )
  const deliveryDate =
    availableDeliveryDates[
      deliveryDateIndex === undefined
        ? availableDeliveryDates.length - 1
        : deliveryDateIndex
    ]
  const shippingPrice = deliveryDate.shippingPrice
  const taxPrice = round2(
    pricedItems.reduce((total, item) => total + (item.vatAmount ?? 0), 0)
  )
  const totalPrice = round2(
    itemsPrice +
      (shippingPrice ? round2(shippingPrice) : 0) +
      (taxInclusive ? 0 : taxPrice)
  )
  return {
    availableDeliveryDates,
    deliveryDateIndex,
    items: pricedItems,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    taxInclusive,
    taxRate,
  }
}

function buildOrder(i: number) {
  const user = seedUsers[i % seedUsers.length]
  const userId = userDocs[i % userDocs.length]._id
  const productIndex = i % productDocs.length
  const product1 = productDocs[productIndex]
  const product2 =
    productDocs[
      productIndex >= productDocs.length - 1 ? productIndex - 1 : productIndex + 1
    ]
  const product3 =
    productDocs[
      productIndex >= productDocs.length - 2 ? productIndex - 2 : productIndex + 2
    ]

  const items = [
    toOrderItem(product1, 1),
    toOrderItem(product2, 2),
    toOrderItem(product3, 3),
  ]
  const priced = priceSeedOrder(items, i % 2)
  const codFee = user.paymentMethod === 'Cash On Delivery' ? 10 : 0
  const totalPrice = round2(priced.totalPrice + codFee)
  const createdAt = calculatePastDate(i + 2)
  const deliveredAt = calculatePastDate(i)
  const paidAt =
    user.paymentMethod === 'Cash On Delivery'
      ? deliveredAt
      : calculatePastDate(i + 1)
  const deliveryOption =
    priced.availableDeliveryDates[priced.deliveryDateIndex]
  const paymentId =
    user.paymentMethod === 'Stripe'
      ? `pi_seed_${i}`
      : user.paymentMethod === 'PayPal'
        ? `PAYPAL-SEED-${i}`
        : `COD-SEED-${i}`

  return {
    user: userId,
    shippingAddress: user.address as ShippingAddress,
    paymentMethod: user.paymentMethod,
    currency: settings.defaultCurrency,
    items: priced.items,
    itemsPrice: priced.itemsPrice,
    shippingPrice: priced.shippingPrice,
    taxPrice: priced.taxPrice,
    totalPrice,
    taxInclusive: priced.taxInclusive,
    taxRate: priced.taxRate,
    codFee,
    shippingRateId: `seed-rate-${priced.deliveryDateIndex}`,
    shippingZone: user.address.city,
    shippingCarrier: 'Manual',
    shippingService: deliveryOption?.name,
    shippingEtaMin: deliveryOption?.daysToDeliver,
    shippingEtaMax: deliveryOption?.daysToDeliver,
    isPickup: false,
    pickupLocation: '',
    isPaid: true,
    isDelivered: true,
    paidAt,
    deliveredAt,
    createdAt,
    expectedDeliveryDate: deliveredAt,
    receiptSentAt: deliveredAt,
    paymentResult: {
      id: paymentId,
      status: 'COMPLETED',
      email_address: user.email,
      pricePaid: totalPrice.toFixed(2),
    },
    ...(user.paymentMethod === 'Stripe'
      ? { stripePaymentIntentId: paymentId }
      : {}),
    ...(user.paymentMethod === 'Moyasar'
      ? { moyasarPaymentId: paymentId }
      : {}),
    isCancelled: false,
    refundedAmount: 0,
    shippingRefunded: false,
    isDisputed: false,
    status: 'delivered',
    statusHistory: [
      { status: 'pending_payment', at: createdAt, note: 'Order created' },
      { status: 'paid', at: paidAt, note: `Paid via ${user.paymentMethod}` },
      { status: 'delivered', at: deliveredAt, note: 'Order delivered' },
    ],
    shipment: {
      provider: 'Manual',
      trackingNumber: `EV-SEED-${100000 + i}`,
      trackingUrl: '',
      shippedAt: paidAt,
      deliveredAt,
      status: 'delivered',
    },
    cartFingerprint: `seed-order-${i}`,
  }
}

const orders: SeedOrder[] = []
for (let i = 0; i < 200; i++) {
  const order = buildOrder(i)
  validate(`order[${i}]`, new Order(order))
  if (!order.isDelivered || !order.deliveredAt)
    problems.push(`order[${i}] is not delivered with deliveredAt`)
  if (order.status !== 'delivered')
    problems.push(`order[${i}] status is not delivered`)
  const expectedTotal = round2(
    order.itemsPrice +
      order.shippingPrice +
      order.codFee +
      (order.taxInclusive ? 0 : order.taxPrice)
  )
  if (order.totalPrice !== expectedTotal)
    problems.push(`order[${i}] totalPrice does not match its components`)
  for (const item of order.items) {
    if (!productDocs.some((product) => String(product._id) === String(item.product)))
      problems.push(`order[${i}] references a missing product`)
    const product = productDocs.find(
      (candidate) => String(candidate._id) === String(item.product)
    )
    if (product && !(product.variants ?? []).some((variant: { id: string }) => variant.id === item.variantId))
      problems.push(`order[${i}] item ${item.sku} does not match a product variant`)
  }
  orders.push(order)
}

// ---------------------------------------------------------------------------
// Reviews: only buyers of a delivered order, pre-approved, one per product/user.
// ---------------------------------------------------------------------------
const buyersByProduct = new Map<
  string,
  Array<{ userId: string; deliveredAt: Date }>
>()
for (const order of orders) {
  const deliveredAt = order.deliveredAt ?? new Date()
  for (const item of order.items) {
    const key = String(item.product)
    const buyers = buyersByProduct.get(key) ?? []
    const userId = String(order.user)
    if (!buyers.some((buyer) => buyer.userId === userId)) {
      buyers.push({ userId, deliveredAt })
      buyersByProduct.set(key, buyers)
    }
  }
}

const reviewKeys = new Set<string>()
let reviewCount = 0
for (const product of productDocs) {
  const buyers = buyersByProduct.get(String(product._id)) ?? []
  let buyerIndex = 0
  for (const { rating, count } of product.ratingDistribution ?? []) {
    const templates = data.reviews.filter((review) => review.rating === rating)
    if (templates.length === 0) continue
    for (let n = 0; n < count && buyerIndex < buyers.length; n++) {
      const template = templates[n % templates.length]
      const buyer = buyers[buyerIndex++]
      const reviewedAt = new Date(
        Math.min(Date.now(), buyer.deliveredAt.getTime() + (n % 10 + 1) * 86400000)
      )
      const review = {
        ...template,
        product: product._id,
        user: buyer.userId,
        isVerifiedPurchase: true,
        isApproved: true,
        approvedAt: reviewedAt,
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
      }
      validate(`review product ${product.slug} rating ${rating}`, new Review(review))
      const key = `${String(product._id)}:${buyer.userId}`
      if (reviewKeys.has(key))
        problems.push(`duplicate review for product/user ${product.slug}`)
      reviewKeys.add(key)
      reviewCount += 1
    }
  }
}

// ---------------------------------------------------------------------------
// Unique keys and final summary
// ---------------------------------------------------------------------------
for (const [label, values] of [
  ['user emails', seedUsers.map((user) => user.email.toLowerCase())],
  ['user phones', seedUsers.map((user) => user.phone)],
  ['product slugs', productDocs.map((product) => product.slug)],
  [
    'variant ids',
    productDocs.flatMap((product) =>
      (product.variants ?? []).map((variant: { id: string }) => variant.id)
    ),
  ],
  [
    'variant SKUs',
    productDocs.flatMap((product) =>
      (product.variants ?? []).map((variant: { sku: string }) => variant.sku)
    ),
  ],
  ['web page slugs', data.webPages.map((page) => page.slug)],
  ['carousel URLs', settings.carousels.map((carousel) => carousel.url)],
  ['order fingerprints', orders.map((order) => order.cartFingerprint)],
] as Array<[string, string[]]>) {
  const repeated = duplicates(values)
  if (repeated.length > 0)
    problems.push(`duplicate ${label}: ${repeated.join(', ')}`)
}

console.log({
  users: userDocs.length,
  products: productDocs.length,
  variants: productDocs.reduce(
    (total, product) => total + (product.variants?.length ?? 0),
    0
  ),
  orders: orders.length,
  reviews: reviewCount,
  settings: data.settings.length,
  webPages: data.webPages.length,
})

if (problems.length > 0) {
  console.error(`Seed compatibility check failed with ${problems.length} issue(s):`)
  for (const problem of problems) console.error(`- ${problem}`)
  process.exitCode = 1
} else {
  console.log('Seed data is compatible with the current models and has no conflicting keys.')
}
