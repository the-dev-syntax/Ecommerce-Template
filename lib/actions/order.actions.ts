'use server'

import { Cart, IOrderList, OrderItem, ShippingAddress } from '@/types'
import { formatError, round2 } from '../utils'
import { connectToDatabase } from '../db'
import { auth } from '@/auth'
import { OrderInputSchema } from '../validator'
import Order, { IOrder } from '../db/models/order.model'

import { paypal } from '../paypal'
import { sendPurchaseReceipt, sendAskReviewOrderItems } from '@/emails'
import { revalidatePath } from 'next/cache'
import mongoose from 'mongoose'
import { DateRange } from 'react-day-picker'
import Product from '../db/models/product.model'
import User from '../db/models/user.model'
import { getSetting } from './setting.actions'

 

// CREATE ORDER - PRIVATE
export const createOrder = async (clientSideCart: Cart) => {
  try {
    await connectToDatabase()
    const session = await auth()
    if (!session) throw new Error('User not authenticated')
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
      ...calcDeliveryDateAndPrice({
        items: clientSideCart.items,
        shippingAddress: clientSideCart.shippingAddress,
        deliveryDateIndex: clientSideCart.deliveryDateIndex,
      }),
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
// GET ORDER - PRIVATE
export async function getOrderById(orderId: string): Promise<IOrder> {
  await connectToDatabase()
  const session = await auth()
    if (!session) throw new Error('User not authenticated')

  const order = await Order.findById(orderId)
  return JSON.parse(JSON.stringify(order))
}

// CREATE PAYPAL ORDER - PRIVATE
export async function createPayPalOrder(orderId: string) {
  await connectToDatabase()
  const session = await auth()
    if (!session) throw new Error('User not authenticated')
  try {
    // get order from db, 
    // if exist ==> send to paypal to createOrder(totalPrice) 
    // update order obj in DB to have a new key paymentResult={...}
    // save to DB
    // return success , paypalOrder.id
    const order = await Order.findById(orderId)
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

// APPROVE PAYPAL ORDER - PRIVATE
export async function approvePayPalOrder(
  orderId: string,
  data: { orderID: string }
) {
  await connectToDatabase()
  const session = await auth()
    if (!session) throw new Error('User not authenticated')
  
  try {
    const order = await Order.findById(orderId).populate('user', 'email')
    if (!order) throw new Error('Order not found')
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
    revalidatePath(`/account/orders/${orderId}`)
    return {
      success: true,
      message: 'Your order has been successfully paid by PayPal',
    }
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
  
  const { availableDeliveryDates } = await getSetting()

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

const taxPrice = !shippingAddress ? undefined : round2(itemsPrice * 0.15)

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

  const {
    common: { pageSize },
  } = await getSetting()
  
  limit = limit || pageSize
  await connectToDatabase()
  const session = await auth()
    if (!session) {
      throw new Error('User is not authenticated')
    }

  const skipAmount = (Number(page) - 1) * limit
  
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

  await connectToDatabase()
  const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')
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
    await connectToDatabase()
    const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')

    const res = await Order.findByIdAndDelete(id)
    if (!res) throw new Error('Order not found')
    revalidatePath('/admin/orders')
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
  await connectToDatabase()
  const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')

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
    await connectToDatabase()
    const session = await auth()
      if (!session) throw new Error('User not authenticated')
        if (session.user.role !== "admin")
          throw new Error('Admin permission required')

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

    revalidatePath(`/account/orders/${orderId}`)
    return { success: true, message: 'Order paid successfully' }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// UPDATE STOCK - ADMIN 
//! replaced Mongoose session ==> sessionM to avoid conflict with Auth session.
const updateProductStock = async (orderId: string) => {
  const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')

  const sessionM = await mongoose.connection.startSession()

  try {
    sessionM.startTransaction()
    const opts = { sessionM }

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
    await connectToDatabase()
       const session = await auth()
      if (session?.user.role !== "admin")
        throw new Error('Admin permission required')
    
    const order = await Order.findById(orderId).populate<{
      user: { email: string; name: string }
    }>('user', 'name email')

    if (!order) throw new Error('Order not found')
    if (!order.isPaid) throw new Error('Order is not paid')

    order.isDelivered = true
    order.deliveredAt = new Date()

    await order.save()

    if (order.user.email) await sendAskReviewOrderItems({ order })

    revalidatePath(`/account/orders/${orderId}`)

    return { success: true, message: 'Order delivered successfully' }
    
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}