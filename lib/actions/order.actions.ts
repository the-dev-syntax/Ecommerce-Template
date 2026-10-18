'use server'

import type Stripe from 'stripe'

import { Cart, IOrderList, OrderItem, ShippingAddress } from '@/types'
import {
  calculateFutureDate,
  clampLimit,
  clampPage,
  formatError,
  generateId,
  round2,
} from '../utils'
import { connectToDatabase } from '../db'
import { auth } from '@/auth'
import { OrderInputSchema } from '../validator'
import Order, { IOrder } from '../db/models/order.model'

import { paypal } from '../paypal'
import { sendAskReviewOrderItems } from '@/emails'
import { DateRange } from 'react-day-picker'
import Product from '../db/models/product.model'
import User from '../db/models/user.model'
import { getSetting } from './setting.actions'
import { revalidateAllLocales } from '../utils-serverOnly'
import { isAdminOrOwner, requireAdmin } from '../access'
import { OrderWithUser } from '../db/models/order.model'
import { fulfillOrder } from '../orders/fulfill-order'


// Internal helper. Must NOT be exported from a 'use server' module, otherwise
// every client could call it as a server action and read any order by id.
async function dbOrderWith3UserKeys(orderId: string): Promise<OrderWithUser | null> {
  await connectToDatabase()
  const order = await Order.findById(orderId).populate<{
    user: { _id: string; email: string; name: string }
  }>('user', '_id name email')
  return order ? (order as OrderWithUser) : null
}
// export async function dbOrderWith3UserKeys(orderId: string): Promise<OrderWithUser> {

//   const order = await Order.findById(orderId).populate<{
//       user: {_id:string, email: string, name: string }
//     }>('user', '_id name email')

//   if (!order) throw new Error('Order not found')
//   return order as OrderWithUser
// }

// Rebuild order items from the database so prices, stock, names and images
// can never be supplied or tampered with by the browser.
const buildOrderItems = async (clientItems: OrderItem[]) => {
  if (!Array.isArray(clientItems) || clientItems.length === 0)
    throw new Error('Order must contain at least one item')
  if (clientItems.length > 50)
    throw new Error('Order cannot contain more than 50 items')

  const productIds = [...new Set(clientItems.map((item) => item.product))]

  await connectToDatabase()
  const products = await Product.find({
    _id: { $in: productIds },
    isPublished: true,
  })
  const productsById = new Map(
    products.map((product) => [product._id.toString(), product])
  )

  return clientItems.map((item) => {
    const product = productsById.get(item.product)
    if (!product)
      throw new Error(`Product is no longer available: ${item.name || item.product}`)

    const quantity = Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity < 1)
      throw new Error(`Invalid quantity for ${product.name}`)
    if (quantity > product.countInStock)
      throw new Error(`Not enough stock for ${product.name}`)

    const image = product.images?.[0]
    if (!image) throw new Error(`Product image is missing: ${product.name}`)

    const size = item.size?.trim() || undefined
    const color = item.color?.trim() || undefined
    if (size && product.sizes?.length && !product.sizes.includes(size))
      throw new Error(`Invalid size for ${product.name}`)
    if (color && product.colors?.length && !product.colors.includes(color))
      throw new Error(`Invalid color for ${product.name}`)

    return {
      clientId: item.clientId || generateId(),
      product: product._id.toString(),
      name: product.name,
      slug: product.slug,
      category: product.category,
      image,
      price: round2(product.price),
      countInStock: product.countInStock,
      quantity,
      size,
      color,
    }
  })
}

// CREATE ORDER - PRIVATE
export const createOrder = async (clientSideCart: Cart) => {
  try {
    const session = await auth()
    if (!session) throw new Error('User not authenticated')

    await connectToDatabase()

    // recalculate price and delivery date on the server
    const createdOrder = await createOrderFromCart(
      clientSideCart,
      session.user.id!
    )
    return {
      success: true,
      message: 'Order placed successfully',
      data: { orderId: createdOrder._id.toString() },
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// RECALCULATE PRICE AND DELIVERY DATE ON THE SERVER - PRIVATE
export const createOrderFromCart = async (
  clientSideCart: Cart,
  userId: string
) => {
  const session = await auth()
  if (!session?.user?.id) throw new Error('User not authenticated')
  if (session.user.id !== userId) throw new Error('User mismatch')

  await connectToDatabase()

  // Ignore every price/stock field sent by the browser.
  const items = await buildOrderItems(clientSideCart.items)

  const {
    availableDeliveryDates,
    availablePaymentMethods,
    defaultCurrency,
    common: { taxRate },
  } = await getSetting()

  const deliveryDateIndex =
    clientSideCart.deliveryDateIndex === undefined
      ? availableDeliveryDates.length - 1
      : clientSideCart.deliveryDateIndex

  if (!Number.isInteger(deliveryDateIndex) || deliveryDateIndex < 0 || deliveryDateIndex >= availableDeliveryDates.length)
    throw new Error('Invalid delivery date')

  const deliveryDate = availableDeliveryDates[deliveryDateIndex]
  if (!deliveryDate) throw new Error('Delivery date is not available')

  const paymentMethod = clientSideCart.paymentMethod
  if (!paymentMethod || !availablePaymentMethods.some((method) => method.name === paymentMethod))
    throw new Error('Invalid payment method')

  const itemsPrice = round2(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  )
  const shippingPrice =
    deliveryDate.freeShippingMinPrice > 0 &&
    itemsPrice >= deliveryDate.freeShippingMinPrice
      ? 0
      : deliveryDate.shippingPrice
  const taxPrice = round2(itemsPrice * taxRate)
  const totalPrice = round2(itemsPrice + shippingPrice + taxPrice)

  // Validate the final order shape after all server-side recalculation.
  const order = OrderInputSchema.parse({
    user: userId,
    items,
    shippingAddress: clientSideCart.shippingAddress,
    paymentMethod,
    currency: defaultCurrency.toUpperCase(),
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    expectedDeliveryDate: calculateFutureDate(deliveryDate.daysToDeliver),
  })

  return await Order.create(order)
}

// for Paypal :
// GET ORDER - PRIVATE ==> edit1 verify that the authenticated user owns the order (or is an admin) , check for undefined too
export async function getOrderById(orderId: string): Promise<IOrder | null> {
  const session = await auth()
  if (!session) throw new Error('User not authenticated')
    
  await connectToDatabase()

  const order = await dbOrderWith3UserKeys(orderId)
   if (!order) throw new Error('Order not found')

  if (!isAdminOrOwner(session.user.id, session.user.role, order.user._id)) return null

  return JSON.parse(JSON.stringify(order))
}

// CREATE PAYPAL ORDER - PRIVATE
export async function createPayPalOrder(orderId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('User not authenticated')

    await connectToDatabase()

    const order = await dbOrderWith3UserKeys(orderId)
    if (!order) throw new Error('Order not found')
    if (!isAdminOrOwner(session.user.id, session.user.role, order.user._id))
      throw new Error('Error accessing order')
    if (order.isPaid) throw new Error('Order is already paid')
    if (order.paymentMethod !== 'PayPal')
      throw new Error('Order is not payable by PayPal')
    if (order.totalPrice <= 0) throw new Error('Order total is invalid')

    const paypalOrder = await paypal.createOrder(
      order.totalPrice,
      (order.currency || 'USD').toUpperCase()
    )

    await Order.findByIdAndUpdate(order._id, {
      paymentResult: {
        id: paypalOrder.id,
        email_address: '',
        status: '',
        pricePaid: '0',
      },
    })

    return {
      success: true,
      message: 'PayPal order created successfully',
      data: paypalOrder.id,
    }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// APPROVE PAYPAL ORDER - PRIVATE
export async function approvePayPalOrder(
  orderId: string,
  data: { orderID: string }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('User not authenticated')

    await connectToDatabase()
    const order = await dbOrderWith3UserKeys(orderId)

    if (!order) throw new Error('Order not found')
    if (!isAdminOrOwner(session.user.id, session.user.role, order.user._id))
      throw new Error('Error accessing order')
    if (order.isPaid) {
      return {
        success: true,
        message: 'Your order has already been paid by PayPal',
      }
    }
    if (order.paymentMethod !== 'PayPal')
      throw new Error('Order is not payable by PayPal')
    if (order.paymentResult?.id !== data.orderID)
      throw new Error('PayPal order does not match this order')

    const captureData = await paypal.capturePayment(data.orderID)
    if (!captureData || captureData.status !== 'COMPLETED')
      throw new Error('PayPal payment was not completed')

    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0]
    const amountPaid = Number(capture?.amount?.value ?? 0)
    const currency = capture?.amount?.currency_code ?? order.currency ?? 'USD'

    await fulfillOrder({
      orderId,
      provider: 'PayPal',
      paymentId: capture?.id ?? captureData.id,
      amountPaid,
      currency,
      email: captureData.payer?.email_address ?? '',
      status: captureData.status,
    })

    await revalidateAllLocales(`/account/orders/${orderId}`)
    await revalidateAllLocales(`/admin/orders/${orderId}`)

    return {
      success: true,
      message: 'Your order has been successfully paid by PayPal',
    }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// VERIFY & FULFILL STRIPE PAYMENT - PRIVATE (success page fallback)
export async function updateOrderToPaidByStripe(
  orderId: string,
  paymentIntentId: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('User not authenticated')

    await connectToDatabase()

    const order = await dbOrderWith3UserKeys(orderId)
    if (!order) throw new Error('Order not found')

    if (!isAdminOrOwner(session.user.id, session.user.role, order.user._id))
      throw new Error('Error accessing order')

    if (order.isPaid) {
      await revalidateAllLocales(`/account/orders/${orderId}`)
      return { success: true, message: 'Order already paid' }
    }

    if (order.paymentMethod !== 'Stripe')
      throw new Error('Order is not payable by Stripe')

    // Verify payment status directly with Stripe.
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded')
      return { success: false, message: 'Payment not completed' }

    if (paymentIntent.metadata.orderId !== orderId)
      throw new Error('Payment intent does not match this order')

    if (
      order.stripePaymentIntentId &&
      order.stripePaymentIntentId !== paymentIntent.id
    )
      throw new Error('Payment intent does not match this order')

    if (paymentIntent.amount !== Math.round(order.totalPrice * 100))
      throw new Error('Paid amount does not match order total')

    if (
      paymentIntent.currency.toUpperCase() !==
      (order.currency || 'USD').toUpperCase()
    )
      throw new Error('Payment currency does not match order')

    await fulfillOrder({
      orderId,
      provider: 'Stripe',
      paymentId: paymentIntent.id,
      amountPaid: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      email:
        paymentIntent.receipt_email ?? order.user?.email ?? '',
      status: paymentIntent.status,
    })

    await revalidateAllLocales(`/account/orders/${orderId}`)
    await revalidateAllLocales(`/admin/orders/${orderId}`)

    return { success: true, message: 'Order paid successfully' }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

export async function createStripePaymentIntent(orderId: string): Promise<{ clientSecret: string } | { error: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('User not authenticated')
    await connectToDatabase()

    const order = await dbOrderWith3UserKeys(orderId)
    if (!order) throw new Error('Order not found')

    if (!isAdminOrOwner(session.user.id, session.user.role, order.user._id))
      return { error: 'Error accessing order' }

    if (order.paymentMethod !== 'Stripe' || order.isPaid)
      return { error: 'Not payable via Stripe' }
    if (order.totalPrice <= 0) return { error: 'Order total is invalid' }

    const currency = (order.currency || 'USD').toLowerCase()
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

    let paymentIntent: Stripe.PaymentIntent | null = null

    if (order.stripePaymentIntentId) {
      const existing = await stripe.paymentIntents.retrieve(
        order.stripePaymentIntentId
      )
      if (existing.status === 'succeeded')
        return { error: 'Order is already paid' }
      if (existing.status === 'processing' || existing.status === 'requires_capture')
        return { error: 'Payment is already processing' }
      if (
        ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
          existing.status
        )
      )
        paymentIntent = existing
    }

    if (!paymentIntent) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.totalPrice * 100),
        currency,
        metadata: { orderId: order._id },
        receipt_email: order.user?.email || undefined,
        description: `Order ${order._id}`,
      })

      await Order.findByIdAndUpdate(order._id, {
        stripePaymentIntentId: paymentIntent.id,
      })
    }

    if (!paymentIntent.client_secret)
      return { error: 'Could not initialize payment' }

    return { clientSecret: paymentIntent.client_secret }
  } catch (error) {
    return { error: formatError(error) }
  }
}


// RECALCULATE CART PRICES FROM THE DATABASE - PRIVATE
export const calcDeliveryDateAndPrice = async ({
  items: clientItems,
  shippingAddress,
  deliveryDateIndex,
}: {
  deliveryDateIndex?: number
  items: OrderItem[]
  shippingAddress?: ShippingAddress
}) => {
  const session = await auth()
  if (!session?.user?.id) throw new Error('User not authenticated')

  // Prices, stock and product details always come from the database.
  // An empty cart is valid while the customer is removing items.
  const items =
    clientItems.length === 0 ? [] : await buildOrderItems(clientItems)

  const {
    availableDeliveryDates,
    common: { taxRate },
  } = await getSetting()

  const resolvedIndex =
    deliveryDateIndex === undefined
      ? availableDeliveryDates.length - 1
      : deliveryDateIndex

  if (!Number.isInteger(resolvedIndex) || resolvedIndex < 0 || resolvedIndex >= availableDeliveryDates.length)
    throw new Error('Invalid delivery date')

  const deliveryDate = availableDeliveryDates[resolvedIndex]
  if (!deliveryDate) throw new Error('Delivery date is not available')

  const itemsPrice = round2(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  )

  const hasItems = items.length > 0

  const shippingPrice = !hasItems
    ? 0
    : !shippingAddress
      ? undefined
      : deliveryDate.freeShippingMinPrice > 0 &&
          itemsPrice >= deliveryDate.freeShippingMinPrice
        ? 0
        : deliveryDate.shippingPrice

  const taxPrice = !hasItems
    ? 0
    : !shippingAddress
      ? undefined
      : round2(itemsPrice * taxRate)

  const totalPrice = round2(
    itemsPrice + (shippingPrice ?? 0) + (taxPrice ?? 0)
  )

  return {
    availableDeliveryDates,
    deliveryDateIndex: resolvedIndex,
    items,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
  }
}

// GET MY ORDERS - PRIVATE
export async function getMyOrders({
  limit,
  page,
}: {
  limit?: number
  page: number
}) {

  const {common: { pageSize }} = await getSetting()
  
  limit = clampLimit(limit, pageSize)
  
  const skipAmount = (clampPage(page) - 1) * limit

  const session = await auth()
  if (!session) {
    throw new Error('User is not authenticated')
  }
  
  await connectToDatabase()
  
  const orders = await Order.find({
    user: session?.user?.id,
  })
    .sort({ createdAt: 'desc' })
    .skip(skipAmount)
    .limit(limit)
    
  const ordersCount = await Order.countDocuments({ user: session?.user?.id })

  return {
    data: JSON.parse(JSON.stringify(orders)),
    totalPages: Math.ceil(ordersCount / limit),
  }
}

// GET ORDERS BY USER - ADMIN
export async function getOrderSummary(date: DateRange) {

   requireAdmin(await auth())

  await connectToDatabase()

  const {
    common: { pageSize },
  } = await getSetting()

  const ordersCount = await Order.countDocuments({
    createdAt: {
      $gte: date.from,
      $lte: date.to,
    },
  })
  const productsCount = await Product.countDocuments({
    createdAt: {
      $gte: date.from,
      $lte: date.to,
    },
  })
  const usersCount = await User.countDocuments({
    createdAt: {
      $gte: date.from,
      $lte: date.to,
    },
  })

  const totalSalesResult = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: date.from,
          $lte: date.to,
        },
      },
    },
    {
      $group: {
        _id: null,
        sales: { $sum: '$totalPrice' },
      },
    },
    { $project: { totalSales: { $ifNull: ['$sales', 0] } } },
  ])  
  const totalSales = totalSalesResult[0] ? totalSalesResult[0].totalSales : 0

  const today = new Date()
  const sixMonthEarlierDate = new Date(
    today.getFullYear(),
    today.getMonth() - 5,
    1
  )
  const monthlySales = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: sixMonthEarlierDate,
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        totalSales: { $sum: '$totalPrice' },
      },
    },
    {
      $project: {
        _id: 0,
        label: '$_id',
        value: '$totalSales',
      },
    },

    { $sort: { label: -1 } },
  ])

  const topSalesCategories = await getTopSalesCategories(date)
  const topSalesProducts = await getTopSalesProducts(date)

  const latestOrders = await Order.find()
    .populate('user', 'name')
    .sort({ createdAt: 'desc' })
    .limit(pageSize)
  return {
    ordersCount,
    productsCount,
    usersCount,
    totalSales,
    monthlySales: JSON.parse(JSON.stringify(monthlySales)),
    salesChartData: JSON.parse(JSON.stringify(await getSalesChartData(date))),
    topSalesCategories: JSON.parse(JSON.stringify(topSalesCategories)),
    topSalesProducts: JSON.parse(JSON.stringify(topSalesProducts)),
    latestOrders: JSON.parse(JSON.stringify(latestOrders)) as IOrderList[],
  }
}

// GET SALES CHART DATA - ADMIN
async function getSalesChartData(date: DateRange) {

   requireAdmin(await auth())


  const result = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: date.from,
          $lte: date.to,
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        totalSales: { $sum: '$totalPrice' },
      },
    },
    {
      $project: {
        _id: 0,
        date: {
          $concat: [
            { $toString: '$_id.year' },
            '/',
            { $toString: '$_id.month' },
            '/',
            { $toString: '$_id.day' },
          ],
        },
        totalSales: 1,
      },
    },
    { $sort: { date: 1 } },
  ])

  return result
}

// GET TOP SALES PRODUCTS - ADMIN
async function getTopSalesProducts(date: DateRange) {
 
   requireAdmin(await auth())

  const result = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: date.from,
          $lte: date.to,
        },
      },
    },
    // Step 1: Unwind orderItems array
    { $unwind: '$items' },

    // Step 2: Group by productId to calculate total sales per product
    {
      $group: {
        _id: {
          name: '$items.name',
          image: '$items.image',
          _id: '$items.product',
        },
        totalSales: {
          $sum: { $multiply: ['$items.quantity', '$items.price'] },
        }, // Assume quantity field in orderItems represents units sold
      },
    },
    {
      $sort: {
        totalSales: -1,
      },
    },
    { $limit: 6 },

    // Step 3: Replace productInfo array with product name and format the output
    {
      $project: {
        _id: 0,
        id: '$_id._id',
        label: '$_id.name',
        image: '$_id.image',
        value: '$totalSales',
      },
    },

    // Step 4: Sort by totalSales in descending order { $sort: { order: -1 } } is wrong.
    { $sort: { value: -1 } },
  ])

  return result
}

// GET TOP SALES CATEGORIES - ADMIN
async function getTopSalesCategories(date: DateRange, limit = 5) {

   requireAdmin(await auth())


  const result = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: date.from,
          $lte: date.to,
        },
      },
    },
    // Step 1: Unwind orderItems array
    { $unwind: '$items' },
    // Step 2: Group by productId to calculate total sales per product
    {
      $group: {
        _id: '$items.category',
        totalSales: { $sum: '$items.quantity' }, // Assume quantity field in orderItems represents units sold
      },
    },
    // Step 3: Sort by totalSales in descending order
    { $sort: { totalSales: -1 } },
    // Step 4: Limit to top N products
    { $limit: limit },
  ])

  return result
}

// DELETE ORDER - ADMIN
export async function deleteOrder(id: string) {
  try {
     requireAdmin(await auth())
    
    await connectToDatabase()

    const order = await Order.findById(id).select('isPaid')
    if (!order) throw new Error('Order not found')
    if (order.isPaid)
      return {
        success: false,
        message:
          'Paid orders cannot be deleted. Keep them for accounting and order history.',
      }

    const res = await Order.findByIdAndDelete(id)
    if (!res) throw new Error('Order not found')
   
   await revalidateAllLocales(`/admin/orders`)

    return {
      success: true,
      message: 'Order deleted successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// GET ALL ORDERS - ADMIN
export async function getAllOrders({
  limit,
  page,
}: {
  limit?: number
  page: number
}) {
  
  const {
    common: { pageSize },
  } = await getSetting()

  limit = clampLimit(limit, pageSize)

  requireAdmin(await auth())
  
  await connectToDatabase()

  const skipAmount = (clampPage(page) - 1) * limit
  const orders = await Order.find()
    .populate('user', 'name')
    .sort({ createdAt: 'desc' })
    .skip(skipAmount)
    .limit(limit)
  const ordersCount = await Order.countDocuments()
  return {
    data: JSON.parse(JSON.stringify(orders)) as IOrderList[],
    totalPages: Math.ceil(ordersCount / limit),
  }
}

// UPDATE ORDER TO PAID - ADMIN (manual / COD collection)
export async function updateOrderToPaid(orderId: string) {
  try {
    requireAdmin(await auth())

    await connectToDatabase()

    const order = await dbOrderWith3UserKeys(orderId)
    if (!order) throw new Error('Order not found')
    if (order.isPaid)
      return { success: true, message: 'Order is already paid' }

    await fulfillOrder({
      orderId,
      provider: order.paymentMethod,
      paymentId: order.paymentResult?.id || `manual-${Date.now()}`,
      amountPaid: order.totalPrice,
      currency: order.currency || 'USD',
      email: order.user?.email ?? '',
      status: 'COMPLETED',
    })

    await revalidateAllLocales(`/account/orders/${orderId}`)
    await revalidateAllLocales(`/admin/orders/${orderId}`)

    return { success: true, message: 'Order paid successfully' }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// MARK AS DELIVERED - ADMIN
export async function deliverOrder(orderId: string) {
  try {
   
    const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')

    await connectToDatabase()

    const order = await dbOrderWith3UserKeys(orderId)

    if (!order) throw new Error('Order not found')
    if (!order.isPaid) throw new Error('Order is not paid')

    order.isDelivered = true
    order.deliveredAt = new Date()

    await order.save()

    if (order.user.email) await sendAskReviewOrderItems({ order })
  
    await revalidateAllLocales(`/account/orders/${orderId}`)

    return { success: true, message: 'Order delivered successfully' }
    
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}


