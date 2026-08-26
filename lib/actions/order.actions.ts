'use server'

import { Cart, IOrderList, OrderItem, ShippingAddress } from '@/types'
import { formatError, round2 } from '../utils'
import { connectToDatabase } from '../db'
import { auth } from '@/auth'
import { OrderInputSchema } from '../validator'
import Order, { IOrder } from '../db/models/order.model'

import { paypal } from '../paypal'
import { sendPurchaseReceipt, sendAskReviewOrderItems } from '@/emails'
import mongoose from 'mongoose'
import { DateRange } from 'react-day-picker'
import Product from '../db/models/product.model'
import User from '../db/models/user.model'
import { getSetting } from './setting.actions'
import { revalidateAllLocales } from '../utils-serverOnly'

 /*
 ? edit1: 
 The cleanest solution is to introduce a reusable helper function that 
 checks whether the current user owns the order or is an admin,
  then call it from each of these four functions. 
  This avoids duplication and maintains consistency.
  ? also:
  ensure the error handling remains sane (returning a result vs throwing)
  - for getById better to through error/empty, avoiding leak of whether the order exists 
  - For the payment actions, we throw an exception inside the try block so that it returns a failed result message
 */

// Helper fn are you the order/account owner or admin

export const isAdminOrOwner = (
  userId: string,
  userRole: string | undefined,
  order: IOrder
): boolean => {
  if (!order || !order.user) return false

  const ownerId =
    typeof order.user === 'object' && '_id' in order.user
      ? String((order.user as { _id: unknown })._id)
      : String(order.user)

  return userId === ownerId || userRole === 'admin'
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
    if (!session) throw new Error('User not authenticated')

    const cart = {
      ...clientSideCart,
      ...(await calcDeliveryDateAndPrice({
        items: clientSideCart.items,
        shippingAddress: clientSideCart.shippingAddress,
        deliveryDateIndex: clientSideCart.deliveryDateIndex,
      })),
    }
    // parse do validate, conform to a type and  error handling.
    // here validate with zod then Order.create(order) create a new instant of order model in DB with this data. 
    const order = OrderInputSchema.parse({
      user: userId,
      items: cart.items,
      shippingAddress: cart.shippingAddress,
      paymentMethod: cart.paymentMethod,
      itemsPrice: cart.itemsPrice,
      shippingPrice: cart.shippingPrice,
      taxPrice: cart.taxPrice,
      totalPrice: cart.totalPrice,
      expectedDeliveryDate: cart.expectedDeliveryDate,
    })

  return await Order.create(order)
}

// for Paypal :
// GET ORDER - PRIVATE ==> edit1 verify that the authenticated user owns the order (or is an admin) , check for undefined too
export async function getOrderById(orderId: string): Promise<IOrder | null> {
  const session = await auth()
  if (!session) throw new Error('User not authenticated')
    
  await connectToDatabase()

  const order = await Order.findById(orderId)
   if (!order) return null

  if (!isAdminOrOwner(session.user.id, session.user.role, order)) return null

  return JSON.parse(JSON.stringify(order))
}

// CREATE PAYPAL ORDER - PRIVATE ==> edit1 verify that the authenticated user owns the order (or is an admin)
export async function createPayPalOrder(orderId: string) {
  try {
    const session = await auth()
    if (!session) throw new Error('User not authenticated')
    
    await connectToDatabase()
    
    // get order from db, 
    // if exist ==> send to paypal to createOrder(totalPrice) 
    // update order obj in DB to have a new key paymentResult={...}
    // save to DB
    // return success , paypalOrder.id
    const order = await Order.findById(orderId)
    if (!order) throw new Error('Order not found')

  if (!isAdminOrOwner(session.user.id, session.user.role, order)) throw new Error('Error accessing order')

    if (order) {
      const paypalOrder = await paypal.createOrder(order.totalPrice)
      order.paymentResult = {
        id: paypalOrder.id,
        email_address: '',
        status: '',
        pricePaid: '0',
      }
      await order.save()
      return {
        success: true,
        message: 'PayPal order created successfully',
        data: paypalOrder.id,
      }
    } else {
      throw new Error('Order not found')
      }
  } catch (err) {
    return { success: false, message: formatError(err) }
    }
}

// APPROVE PAYPAL ORDER - PRIVATE ==> edit1
export async function approvePayPalOrder(
  orderId: string,
  data: { orderID: string }
) {
  try {
    const session = await auth()
    if (!session) throw new Error('User not authenticated')
      
    await connectToDatabase()

    const order = await Order.findById(orderId).populate('user', 'email')
    if (!order) throw new Error('Order not found')

    if (!isAdminOrOwner(session.user.id, session.user.role, order)) throw new Error('Error accessing order')

      // orderID is the one returned from createPayPalOrder  {...,  data: paypalOrder.id}
    const captureData = await paypal.capturePayment(data.orderID)
    if (
      !captureData ||
      captureData.id !== order.paymentResult?.id ||
      captureData.status !== 'COMPLETED'
    )
      throw new Error('Error in paypal payment')
    order.isPaid = true
    order.paidAt = new Date()
    order.paymentResult = {
      id: captureData.id,
      status: captureData.status,
      email_address: captureData.payer.email_address,
      pricePaid:
        captureData.purchase_units[0]?.payments?.captures[0]?.amount?.value,
    }
    await order.save()
    await sendPurchaseReceipt({ order })    
  
    await revalidateAllLocales(`/account/orders/${orderId}`);    
    
    return {
      success: true,
      message: 'Your order has been successfully paid by PayPal',
    }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// VERIFY & MARK ORDER PAID BY STRIPE - PRIVATE (success page fallback) ==> edit1
export async function updateOrderToPaidByStripe(
  orderId: string,
  paymentIntentId: string
) {
  try {
    const session = await auth()
    if (!session) throw new Error('User not authenticated')
      
    await connectToDatabase()

    const order = await Order.findById(orderId).populate<{
      user: { email: string; name: string }
    }>('user', 'name email')
    if (!order) throw new Error('Order not found')

    if (!isAdminOrOwner(session.user.id, session.user.role, order)) throw new Error('Error accessing order')
    
    if (order.isPaid) return { success: true, message: 'Order already paid' }

    // Capture email BEFORE save — Mongoose replaces populated user with
    // the raw ObjectId on save(), making order.user.email null afterwards.
    const userEmail = order.user?.email ?? ''

    // Verify payment status directly with Stripe
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
    const paymentIntentFromStripe = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntentFromStripe.status !== 'succeeded') {
      return { success: false, message: 'Payment not completed' }
    }

    // Verify Payment Intent metadata/amount alignment
    if (
      order.stripePaymentIntentId &&
      order.stripePaymentIntentId !== paymentIntentFromStripe.id
    ) {
      throw new Error('Payment intent does not match this order')
    }

    if (paymentIntentFromStripe.amount !== Math.round(order.totalPrice * 100)) {
      throw new Error('Paid amount does not match order total')
    }

    order.isPaid = true
    order.paidAt = new Date()
    order.paymentResult = {
      id: paymentIntentFromStripe.id,
      status: paymentIntentFromStripe.status,
      email_address: userEmail,
      pricePaid: String(paymentIntentFromStripe.amount / 100),
    }
    await order.save()

    // Send receipt in a separate try-catch — a failed email must never
    // surface as a payment failure since the order is already saved as paid.
    try {
      if (userEmail) await sendPurchaseReceipt({ order })
    } catch (emailErr) {
      console.error('Purchase receipt email failed (order still paid):', emailErr)
    }

    await revalidateAllLocales(`/account/orders/${orderId}`)

    return { success: true, message: 'Order paid successfully' }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// UPDATE ORDER SHIPPING ADDRESS - PRIVATE
export const calcDeliveryDateAndPrice = async ({
  items,
  shippingAddress,
  deliveryDateIndex
}: {
  deliveryDateIndex?: number
  items: OrderItem[]
  shippingAddress?:ShippingAddress
}) => {
  
  const session = await auth()
    if (!session) throw new Error('User not authenticated')
  
  const { availableDeliveryDates, common: { taxRate } } = await getSetting()

  const itemsPrice = round2(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  )
 
  const deliveryDate =
  availableDeliveryDates[
    deliveryDateIndex === undefined
      ? availableDeliveryDates.length - 1
      : deliveryDateIndex
  ]

const shippingPrice =
  !shippingAddress || !deliveryDate
    ? undefined
    : deliveryDate.freeShippingMinPrice > 0 &&
      itemsPrice >= deliveryDate.freeShippingMinPrice
    ? 0
    : deliveryDate.shippingPrice

const taxPrice = !shippingAddress ? undefined : round2(itemsPrice * taxRate)

const totalPrice = round2(
  itemsPrice +
    (shippingPrice ? round2(shippingPrice) : 0) +
    (taxPrice ? round2(taxPrice) : 0)
)
return {
  availableDeliveryDates,
  deliveryDateIndex:
    deliveryDateIndex === undefined
      ? availableDeliveryDates.length - 1
      : deliveryDateIndex,
  itemsPrice,
  shippingPrice,
  taxPrice,
  totalPrice  
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
  
  limit = limit || pageSize
  
  const skipAmount = (Number(page) - 1) * limit

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

  const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')

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

  const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')


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
 
  const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')

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

  const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')


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
    const session = await auth()
    if (session?.user.role !== "admin")
      throw new Error('Admin permission required')
    
    await connectToDatabase()

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

  limit = limit || pageSize
  const session = await auth()
  if (session?.user.role !== "admin")
    throw new Error('Admin permission required')
  
  await connectToDatabase()

  const skipAmount = (Number(page) - 1) * limit
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

// UPDATE ORDER TO PAID - ADMIN
export async function updateOrderToPaid(orderId: string) {
  try {
    const session = await auth()
    if (!session) throw new Error('User not authenticated')
      
      if (session.user.role !== "admin")
        throw new Error('Admin permission required')
      
    await connectToDatabase()

    const order = await Order.findById(orderId).populate<{
      user: { email: string; name: string }
    }>('user', 'name email')
    
    if (!order) throw new Error('Order not found')
    if (order.isPaid) throw new Error('Order is already paid')
    order.isPaid = true
    order.paidAt = new Date()
    await order.save()
    // if not in development mode, update product stock
    if (!process.env.MONGODB_URI?.startsWith('mongodb://localhost'))
      await updateProductStock(order._id)

    if (order.user.email) await sendPurchaseReceipt({ order })

    await revalidateAllLocales(`/account/orders/${orderId}`);

    return { success: true, message: 'Order paid successfully' }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// UPDATE STOCK - ADMIN 
const updateProductStock = async (orderId: string) => {
  const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')

  const sessionM = await mongoose.connection.startSession()

  try {
    sessionM.startTransaction()
    const opts = { session: sessionM }

    const order = await Order.findOneAndUpdate(
      { _id: orderId },
      { isPaid: true, paidAt: new Date() },
      opts
    )
    if (!order) throw new Error('Order not found')

    for (const item of order.items) {
      const product = await Product.findById(item.product).session(sessionM)
      if (!product) throw new Error('Product not found')

      product.countInStock -= item.quantity
      await Product.updateOne(
        { _id: product._id },
        { countInStock: product.countInStock },
        opts
      )
    }
    await sessionM.commitTransaction()
    sessionM.endSession()
    return true
  } catch (error) {
    await sessionM.abortTransaction()
    sessionM.endSession()
    throw error
  }
}

// MARK AS DELIVERED - ADMIN
export async function deliverOrder(orderId: string) {
  try {
   
    const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')

    await connectToDatabase()

    const order = await Order.findById(orderId).populate<{
      user: { email: string; name: string }
    }>('user', 'name email')

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


export async function createStripePaymentIntent(orderId: string): Promise<{ clientSecret: string } | { error: string }> {
  try {
    const session = await auth()
    if (!session) throw new Error('User not authenticated')
    await connectToDatabase()

    const order = await Order.findById(orderId)
    if (!order) return { error: 'Order not found' }
    if (!isAdminOrOwner(session.user.id, session.user.role, order)) return { error: 'Error accessing order' }

    if (order.paymentMethod !== 'Stripe' || order.isPaid) return { error: 'Not payable via Stripe' }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalPrice * 100),
      currency: 'USD',
      metadata: { orderId: order._id },
    })

    // Store the intent ID on the order 
    order.stripePaymentIntentId = paymentIntent.id
    await order.save()

    return { clientSecret: paymentIntent.client_secret! }
  } catch (error) {
    return { error: formatError(error) }
  }
}