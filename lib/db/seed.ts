import developmentData from '@/lib/data'
import productionData, {
  assertProductionDataReady,
} from '@/lib/production-data'
import { connectToDatabase } from '.'
import Product from './models/product.model'
import { cwd } from 'process'
import { loadEnvConfig } from '@next/env'
import User from './models/user.model'
import Review from './models/review.model'
import Order from './models/order.model'
import { IOrderInput, OrderItem, ShippingAddress } from '@/types'
import { calculateFutureDate, calculatePastDate, generateId, round2 } from '../utils'
import WebPage from './models/web-page.model'
import Setting from './models/setting.model'
import { priceOrderItems } from '../tax'
import { normalizeProductVariants } from '../product-variants'

// calling this function give you access to the .env file
loadEnvConfig(cwd())

// `npm run seed` uses the made-up development catalogue. `seed:production`
// uses the real production-data.ts file and never creates demo orders/reviews.
const useProduction = process.argv.includes('--production')
const data = useProduction ? productionData : developmentData

const main = async () => {
  try {
    // Destructive: this wipes settings, web pages, users, products, reviews
    // and orders. Refuse to run in production/Vercel unless the operator
    // explicitly confirms with --force (or SEED_ALLOW_DESTRUCTIVE=true).
    const destructiveConfirmed =
      process.argv.includes('--force') ||
      process.env.SEED_ALLOW_DESTRUCTIVE === 'true'
    const looksLikeProduction =
      process.env.NODE_ENV === 'production' || !!process.env.VERCEL
    if (looksLikeProduction && !destructiveConfirmed) {
      console.error(
        'Refusing to seed: this script deletes all data. Re-run with --force (or SEED_ALLOW_DESTRUCTIVE=true) only if you are certain.'
      )
      process.exit(1)
    }

    // The production file is a template until every placeholder is replaced.
    // Refuse before deleting anything when it is still incomplete.
    if (useProduction) assertProductionDataReady(productionData)

    // console.log("Seeding DB:", process.env.MONGODB_URI);
    const { products, users, reviews, webPages, settings } = data

    await connectToDatabase(process.env.MONGODB_URI)

    // Production seeding is a first-run operation. Refuse to delete data that
    // may already be referenced by real orders/reviews; use admin screens or a
    // migration instead of re-seeding a live database.
    if (useProduction) {
      const [settingsCount, userCount, productCount, pageCount, reviewCount, orderCount] =
        await Promise.all([
          Setting.countDocuments(),
          User.countDocuments(),
          Product.countDocuments(),
          WebPage.countDocuments(),
          Review.countDocuments(),
          Order.countDocuments(),
        ])
      const existing = (
        [
          ['settings', settingsCount],
          ['users', userCount],
          ['products', productCount],
          ['web pages', pageCount],
          ['reviews', reviewCount],
          ['orders', orderCount],
        ] as [string, number][]
      ).filter(([, count]) => count > 0)
      if (existing.length > 0) {
        throw new Error(
          `Production seed requires an empty database (found ${existing
            .map(([name, count]) => `${count} ${name}`)
            .join(', ')}). Use a fresh database or a migration instead.`
        )
      }
    }

    await Setting.deleteMany()
    const createdSetting = await Setting.insertMany(settings)

    await WebPage.deleteMany()
    await WebPage.insertMany(webPages)

    await User.deleteMany()
    const createdUser = await User.insertMany(users)

    await Product.deleteMany()
    const createdProducts = await Product.insertMany(
      products.map(normalizeProductVariants)
    )

    // Demo reviews and 200 generated orders belong to the development seed
    // only. A production run seeds the real catalogue and admin accounts and
    // leaves orders/reviews to real customers.
    let createdReviews: unknown[] = []
    let createdOrders: unknown[] = []
    if (!useProduction) {
      await Review.deleteMany()
      const rws = []
      for (let i = 0; i < createdProducts.length; i++) {
        let x = 0
        const { ratingDistribution } = createdProducts[i]
        for (let j = 0; j < ratingDistribution.length; j++) {
          for (let k = 0; k < ratingDistribution[j].count; k++) {
            x++
            rws.push({
              //[reviews][number]= one review object
              ...reviews.filter((rev) => rev.rating === j + 1)[
                x % reviews.filter((rev) => rev.rating === j + 1).length
              ],
              isVerifiedPurchase: true,
              // Seeded demo reviews are pre-approved so the storefront starts
              // with the ratings shipped in the seed data.
              isApproved: true,
              approvedAt: new Date(),
              product: createdProducts[i]._id,
              user: createdUser[x % createdUser.length]._id,
              updatedAt: Date.now(),
              createdAt: Date.now(),
            })
          }
        }
      }
      createdReviews = await Review.insertMany(rws)

      await Order.deleteMany()

      const orders = []
      for (let i = 0; i < 200; i++) {
        orders.push(
          await generateOrder(
            i,
            createdUser.map((x) => x._id),
            createdProducts.map((x) => x._id)
          )
        )
      }
      createdOrders = await Order.insertMany(orders)
    }

    // Never log the inserted documents: user documents contain password
    // hashes and verification fields. Counts are enough for the operator.
    console.log({
      users: createdUser.length,
      products: createdProducts.length,
      reviews: createdReviews.length,
      orders: createdOrders.length,
      settings: createdSetting.length,
      message: 'Seeded database successfully',
    })

    process.exit(0)
  } catch (error) {
    console.error(
      'Seeding failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new Error('Failed to seed database')
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSeedOrderItem(product: any, quantity: number) {
  const variant =
    product.variants?.find((candidate: { isDefault?: boolean }) => candidate.isDefault) ??
    product.variants?.[0]

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

const generateOrder = async (
  i: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any
): Promise<IOrderInput> => {
  const product1 = await Product.findById(products[i % products.length])

  const product2 = await Product.findById(
    products[
      i % products.length >= products.length - 1
        ? (i % products.length) - 1
        : (i % products.length) + 1
    ]
  )
  const product3 = await Product.findById(
    products[
      i % products.length >= products.length - 2
        ? (i % products.length) - 2
        : (i % products.length) + 2
    ]
  )

  if (!product1 || !product2 || !product3) throw new Error('Product not found')

  const user = data.users[i % users.length]
  const items = [
    toSeedOrderItem(product1, 1),
    toSeedOrderItem(product2, 2),
    toSeedOrderItem(product3, 3),
  ]
  const priced = calcDeliveryDateAndPriceForSeed({
    items,
    shippingAddress: user.address,
    deliveryDateIndex: i % 2,
  })
  const codFee = user.paymentMethod === 'Cash On Delivery' ? 10 : 0
  const totalPrice = round2(priced.totalPrice + codFee)
  const createdAt = calculatePastDate(i + 2)
  const paidAt = calculatePastDate(i + 1)
  const deliveredAt = calculatePastDate(i)
  const deliveryOption =
    priced.availableDeliveryDates[priced.deliveryDateIndex]

  const order = {
    user: users[i % users.length],
    shippingAddress: user.address,
    paymentMethod: user.paymentMethod,
    currency: data.settings[0].defaultCurrency,
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
    isPaid: true,
    isDelivered: true,
    paidAt,
    deliveredAt,
    createdAt,
    expectedDeliveryDate: calculateFutureDate(i % 2),
    paymentResult: {
      id: `seed-payment-${i}`,
      status: 'COMPLETED',
      email_address: user.email,
      pricePaid: totalPrice.toFixed(2),
    },
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
  }
  return order as IOrderInput
}

export const calcDeliveryDateAndPriceForSeed = ({
  items,
  deliveryDateIndex,
}: {
  deliveryDateIndex?: number
  items: OrderItem[]
  shippingAddress?: ShippingAddress
}) => {

  const {
    availableDeliveryDates,
    common: { taxRate, taxInclusive },
  } = data.settings[0]

  const pricedItems = priceOrderItems(items, taxRate, taxInclusive)
  const itemsPrice = round2(
    pricedItems.reduce((acc, item) => acc + item.price * item.quantity, 0)
  )

  const deliveryDate =
    availableDeliveryDates[
      deliveryDateIndex === undefined
        ? availableDeliveryDates.length - 1
        : deliveryDateIndex
    ]

  const shippingPrice = deliveryDate.shippingPrice

  const taxPrice = round2(
    pricedItems.reduce((acc, item) => acc + (item.vatAmount ?? 0), 0)
  )
  const totalPrice = round2(
    itemsPrice +
      (shippingPrice ? round2(shippingPrice) : 0) +
      (taxInclusive ? 0 : taxPrice)
  )
  return {
    availableDeliveryDates,
    deliveryDateIndex:
      deliveryDateIndex === undefined
        ? availableDeliveryDates.length - 1
        : deliveryDateIndex,
    items: pricedItems,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    taxInclusive,
    taxRate,
  }
}

main()
