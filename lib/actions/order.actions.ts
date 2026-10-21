'use server'

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
import {
  OrderInputSchema,
  OrderReturnInputSchema,
  ShippingAddressSchema,
} from '../validator'
import Order, { IOrder } from '../db/models/order.model'

import { paypal } from '../paypal'
import { getPaymentAdapter } from '../payments/adapters'
import { sendAskReviewOrderItems, sendOrderShippedEmail } from '@/emails'
import { DateRange } from 'react-day-picker'
import Product from '../db/models/product.model'
import User from '../db/models/user.model'
import { getSetting } from './setting.actions'
import { revalidateAllLocales } from '../utils-serverOnly'
import { isAdminOrOwner, requireAdmin } from '../access'
import { OrderWithUser } from '../db/models/order.model'
import { fulfillOrder } from '../orders/fulfill-order'
import { cancelOrderById, processOrderReturn } from '../orders/refund-order'
import {
  releaseExpiredReservations,
  releaseStockReservation,
  reserveStockForOrder,
} from '../orders/stock-reservations'
import type { IOrderReturnInput } from '@/types'
import { priceOrderItems } from '../tax'
import {
  fetchMoyasarPayment,
  isMoyasarPaid,
  toMoyasarAmount,
} from '../payments/moyasar'
import { getEnabledPaymentMethods, isPaymentProvider } from '../payments'
import {
  createStripeIntent,
  retrieveStripeIntent,
} from '../payments/stripe'
import { getShippingProvider } from '../shipping'
import { getShippingRates } from '../shipping/rates'
import { getLowStockCount } from './inventory.actions'


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

    const variantId = item.variantId?.trim()
    let variant = variantId
      ? product.variants?.find((candidate) => candidate.id === variantId)
      : undefined
    if (variantId && !variant)
      throw new Error(`Variant is no longer available: ${product.name}`)

    // Older persisted carts may have size/color but no variant id. Resolve the
    // matching/default variant instead of trusting the product-level price.
    if (!variant && !variantId && (product.variants?.length ?? 0) > 0) {
      const requestedSize = item.size?.trim()
      const requestedColor = item.color?.trim()
      const matched =
        requestedSize || requestedColor
          ? product.variants?.find(
              (candidate) =>
                (!requestedSize || candidate.size === requestedSize) &&
                (!requestedColor || candidate.color === requestedColor)
            )
          : undefined
      variant =
        matched ??
        product.variants?.find((candidate) => candidate.isDefault) ??
        product.variants?.[0]
    }
    if (!variant && (product.variants?.length ?? 0) > 0)
      throw new Error(`Choose an available variant for ${product.name}`)

    const availableStock = variant
      ? variant.countInStock
      : product.countInStock
    if (quantity > availableStock)
      throw new Error(`Not enough stock for ${product.name}`)

    const image = variant?.image || product.images?.[0]
    if (!image) throw new Error(`Product image is missing: ${product.name}`)

    const size = variant?.size || item.size?.trim() || undefined
    const color = variant?.color || item.color?.trim() || undefined
    if (!variant && size && !(product.sizes ?? []).includes(size))
      throw new Error(`Invalid size for ${product.name}`)
    if (!variant && color && !(product.colors ?? []).includes(color))
      throw new Error(`Invalid color for ${product.name}`)

    return {
      clientId: generateId(),
      product: product._id.toString(),
      name: product.name,
      slug: product.slug,
      category: product.category,
      image,
      price: round2(variant?.price ?? product.price),
      taxCategory: product.taxCategory ?? 'S',
      exemptionReasonCode: product.exemptionReasonCode ?? '',
      returnPolicy: product.returnPolicy ?? 'return_and_refund',
      refundedQuantity: 0,
      restockedQuantity: 0,
      countInStock: availableStock,
      quantity,
      size,
      color,
      variantId: variant?.id,
      sku: variant?.sku,
      variantLabel: variant
        ? [variant.size, variant.color].filter(Boolean).join(' / ')
        : undefined,
      weight: variant?.weight ?? 0,
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
  const shippingAddress = clientSideCart.shippingAddress
    ? ShippingAddressSchema.parse(clientSideCart.shippingAddress)
    : undefined

  const {
    availableDeliveryDates: settingDeliveryDates,
    availablePaymentMethods,
    availableCurrencies,
    defaultCurrency,
    seller,
    features,
    common: { taxRate, taxInclusive },
  } = await getSetting()

  const paymentMethod = clientSideCart.paymentMethod
  const enabledPaymentMethods = getEnabledPaymentMethods(
    availablePaymentMethods,
    { cashOnDelivery: features.cashOnDelivery }
  )
  if (!paymentMethod || !enabledPaymentMethods.some((method) => method.name === paymentMethod))
    throw new Error('Invalid payment method')

  const pricedItems = priceOrderItems(items, taxRate, taxInclusive)
  const itemsPrice = round2(
    pricedItems.reduce((acc, item) => acc + item.price * item.quantity, 0)
  )
  const pickupLocation = [
    seller.street,
    seller.buildingNumber,
    seller.citySubdivision,
    seller.city,
  ]
    .filter(Boolean)
    .join(', ')
  const shippingQuotes = shippingAddress
    ? await getShippingRates({
        country: shippingAddress.country,
        region: shippingAddress.province,
        city: shippingAddress.city,
        items: pricedItems,
        itemsPrice,
        pickupLocation,
      })
    : []
  const deliveryOptions =
    shippingQuotes.length > 0
      ? shippingQuotes.map((quote) => ({
          name: quote.name,
          daysToDeliver: quote.etaMaxDays,
          shippingPrice: quote.shippingPrice,
          freeShippingMinPrice: 0,
        }))
      : settingDeliveryDates

  const requestedIndex =
    clientSideCart.deliveryDateIndex === undefined
      ? shippingQuotes.length > 0
        ? 0
        : deliveryOptions.length - 1
      : clientSideCart.deliveryDateIndex
  const deliveryDateIndex = Math.min(
    Math.max(0, requestedIndex),
    deliveryOptions.length - 1
  )

  if (!Number.isInteger(deliveryDateIndex))
    throw new Error('Invalid delivery date')

  const deliveryDate = deliveryOptions[deliveryDateIndex]
  if (!deliveryDate) throw new Error('Delivery date is not available')
  const selectedQuote = shippingQuotes[deliveryDateIndex]

  const shippingPrice = selectedQuote
    ? selectedQuote.shippingPrice
    : deliveryDate.freeShippingMinPrice > 0 &&
        itemsPrice >= deliveryDate.freeShippingMinPrice
      ? 0
      : deliveryDate.shippingPrice
  const codFee =
    paymentMethod === 'Cash On Delivery' ? (selectedQuote?.codFee ?? 0) : 0
  const taxPrice = round2(
    pricedItems.reduce((acc, item) => acc + (item.vatAmount ?? 0), 0)
  )
  const totalPrice = round2(
    itemsPrice + shippingPrice + codFee + (taxInclusive ? 0 : taxPrice)
  )

  const orderCurrency =
    availableCurrencies.find((currency) => currency.isBase)?.code ??
    defaultCurrency
  // Validate the final order shape after all server-side recalculation.
  const order = OrderInputSchema.parse({
    user: userId,
    items: pricedItems,
    shippingAddress,
    paymentMethod,
    currency: orderCurrency.toUpperCase(),
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    taxInclusive,
    taxRate,
    shippingRateId: selectedQuote?.id,
    shippingZone: selectedQuote?.zoneName,
    shippingCarrier: selectedQuote?.carrier,
    shippingService: selectedQuote?.serviceName,
    shippingEtaMin: selectedQuote?.etaMinDays,
    shippingEtaMax: selectedQuote?.etaMaxDays,
    isPickup: selectedQuote?.isPickup ?? false,
    pickupLocation: selectedQuote?.pickupLocation,
    codFee,
    expectedDeliveryDate: calculateFutureDate(
      Math.max(1, selectedQuote ? selectedQuote.etaMaxDays : deliveryDate.daysToDeliver)
    ),
  })

  const created = await Order.create({
    ...order,
    status: 'pending_payment',
    statusHistory: [
      { status: 'pending_payment', at: new Date(), note: 'Order created' },
    ],
  })
  try {
    await releaseExpiredReservations()
    await reserveStockForOrder({
      ...created.toObject(),
      _id: String(created._id),
      paymentMethod: created.paymentMethod,
    })
  } catch (error) {
    await Order.deleteOne({ _id: created._id })
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to reserve stock for this order'
    )
  }
  return created
}

// for Paypal :
// GET ORDER - PRIVATE ==> edit1 verify that the authenticated user owns the order (or is an admin) , check for undefined too
export async function getOrderById(orderId: string): Promise<IOrder | null> {
  const session = await auth()
  if (!session) throw new Error('User not authenticated')
    
  await connectToDatabase()

  const order = await dbOrderWith3UserKeys(orderId)
   if (!order) throw new Error('Order not found')

  if (!isAdminOrOwner(session.user.id, session.user.role, order.user?._id)) return null

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
    if (!isAdminOrOwner(session.user.id, session.user.role, order.user?._id))
      throw new Error('Error accessing order')
    if (order.isPaid) throw new Error('Order is already paid')
    if (order.isCancelled) throw new Error('Order is cancelled')
    if (!isPaymentProvider(order.paymentMethod, 'paypal'))
      throw new Error('Order is not payable by PayPal')
    if (order.totalPrice <= 0) throw new Error('Order total is invalid')

    const adapter = getPaymentAdapter('paypal')
    if (!adapter?.createOrder) throw new Error('PayPal adapter is unavailable')
    const paypalOrder = await adapter.createOrder(
      order.totalPrice,
      (order.currency || 'SAR').toUpperCase()
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
    if (!isAdminOrOwner(session.user.id, session.user.role, order.user?._id))
      throw new Error('Error accessing order')
    if (order.isPaid) {
      return {
        success: true,
        message: 'Your order has already been paid by PayPal',
      }
    }
    if (!isPaymentProvider(order.paymentMethod, 'paypal'))
      throw new Error('Order is not payable by PayPal')
    if (order.paymentResult?.id !== data.orderID)
      throw new Error('PayPal order does not match this order')

    const adapter = getPaymentAdapter('paypal')
    if (!adapter?.captureOrder) throw new Error('PayPal adapter is unavailable')
    const captureData = (await adapter.captureOrder(
      data.orderID
    )) as Awaited<ReturnType<typeof paypal.capturePayment>>
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

    if (!isAdminOrOwner(session.user.id, session.user.role, order.user?._id))
      throw new Error('Error accessing order')

    if (order.isPaid) {
      await revalidateAllLocales(`/account/orders/${orderId}`)
      return { success: true, message: 'Order already paid' }
    }

    if (order.isCancelled) throw new Error('Order is cancelled')

    if (!isPaymentProvider(order.paymentMethod, 'stripe'))
      throw new Error('Order is not payable by Stripe')

    // Verify payment status directly with Stripe.
    const paymentIntent = await retrieveStripeIntent(paymentIntentId)

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
    await revalidateAllLocales('/admin/orders')

    return { success: true, message: 'Order paid successfully' }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// VERIFY & FULFILL MOYASAR PAYMENT - PRIVATE (callback fallback)
export async function updateOrderToPaidByMoyasar(
  orderId: string,
  paymentId: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('User not authenticated')

    await connectToDatabase()

    const order = await dbOrderWith3UserKeys(orderId)
    if (!order) throw new Error('Order not found')

    if (!isAdminOrOwner(session.user.id, session.user.role, order.user?._id))
      throw new Error('Error accessing order')

    if (order.isPaid) {
      await revalidateAllLocales(`/account/orders/${orderId}`)
      return { success: true, message: 'Order already paid' }
    }

    if (order.isCancelled) throw new Error('Order is cancelled')

    if (!isPaymentProvider(order.paymentMethod, 'moyasar'))
      throw new Error('Order is not payable by Moyasar')

    if (typeof paymentId !== 'string' || !paymentId.trim())
      throw new Error('Invalid payment reference')

    const payment = await fetchMoyasarPayment(paymentId)

    if (!isMoyasarPaid(payment.status))
      return { success: false, message: 'Payment not completed' }

    if (payment.metadata?.orderId !== String(order._id))
      throw new Error('Payment does not match this order')

    if (payment.amount !== toMoyasarAmount(order.totalPrice))
      throw new Error('Paid amount does not match order total')

    if (
      payment.currency.toUpperCase() !==
      (order.currency || 'SAR').toUpperCase()
    )
      throw new Error('Payment currency does not match order')

    if (order.moyasarPaymentId && order.moyasarPaymentId !== payment.id)
      throw new Error('Payment does not match this order')

    await Order.findByIdAndUpdate(orderId, {
      moyasarPaymentId: payment.id,
    })

    await fulfillOrder({
      orderId,
      provider: 'Moyasar',
      paymentId: payment.id,
      amountPaid: payment.amount / 100,
      currency: payment.currency,
      email: order.user?.email ?? '',
      status: payment.status,
    })

    await revalidateAllLocales(`/account/orders/${orderId}`)
    await revalidateAllLocales(`/admin/orders/${orderId}`)
    await revalidateAllLocales('/admin/orders')

    return { success: true, message: 'Order paid successfully' }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// PROCESS AN ITEM-LEVEL RETURN/REFUND - ADMIN
export async function refundOrderItems(input: IOrderReturnInput) {
  try {
    const session = await auth()
    requireAdmin(session)

    const parsed = OrderReturnInputSchema.parse(input)
    const result = await processOrderReturn({
      ...parsed,
      createdBy: session?.user?.id,
      createdByEmail: session?.user?.email ?? '',
    })

    await revalidateAllLocales(`/account/orders/${parsed.orderId}`)
    await revalidateAllLocales(`/admin/orders/${parsed.orderId}`)
    await revalidateAllLocales(`/invoice/${parsed.orderId}`)
    await revalidateAllLocales('/admin/orders')

    return {
      success: true,
      message: result.fullyRefunded
        ? `Order fully refunded (${result.refundedAmount.toFixed(2)} ${result.order.currency})`
        : `Refund processed via ${result.provider} (${result.refundAmount.toFixed(2)} ${result.order.currency})`,
      data: {
        provider: result.provider,
        refundAmount: result.refundAmount,
        refundedAmount: result.refundedAmount,
      },
    }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// CANCEL AN ORDER, REFUNDING A PAID MOYASAR PAYMENT - ADMIN
export async function cancelOrder(
  orderId: string,
  reason?: string,
  manualReference?: string
) {
  try {
    const session = await auth()
    requireAdmin(session)

    const result = await cancelOrderById(orderId, reason, {
      manualReference,
      createdBy: session?.user?.id,
      createdByEmail: session?.user?.email ?? '',
    })

    await revalidateAllLocales(`/account/orders/${orderId}`)
    await revalidateAllLocales(`/admin/orders/${orderId}`)
    await revalidateAllLocales(`/invoice/${orderId}`)
    await revalidateAllLocales('/admin/orders')

    return {
      success: true,
      message: result.alreadyCancelled
        ? 'Order is already cancelled'
        : result.refundedAmount > 0
          ? `Order cancelled and ${result.refundedAmount.toFixed(2)} ${result.order.currency} refunded`
          : 'Order cancelled',
    }
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

    if (!isAdminOrOwner(session.user.id, session.user.role, order.user?._id))
      return { error: 'Error accessing order' }

    if (!isPaymentProvider(order.paymentMethod, 'stripe') || order.isPaid)
      return { error: 'Not payable via Stripe' }
    if (order.isCancelled) return { error: 'Order is cancelled' }
    if (order.totalPrice <= 0) return { error: 'Order total is invalid' }

    const currency = (order.currency || 'USD').toLowerCase()
    let paymentIntent: Awaited<ReturnType<typeof retrieveStripeIntent>> | null =
      null

    if (order.stripePaymentIntentId) {
      const existing = await retrieveStripeIntent(order.stripePaymentIntentId)
      if (existing.metadata.orderId !== order._id.toString())
        return { error: 'Payment intent does not match this order' }
      if (
        existing.amount !== Math.round(order.totalPrice * 100) ||
        existing.currency.toLowerCase() !== currency
      )
        return { error: 'Payment intent does not match this order total' }
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
      paymentIntent = await createStripeIntent({
        amount: order.totalPrice,
        currency,
        orderId: order._id.toString(),
        email: order.user?.email,
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
  paymentMethod,
}: {
  deliveryDateIndex?: number
  items: OrderItem[]
  shippingAddress?: ShippingAddress
  paymentMethod?: string
}) => {
  const session = await auth()
  if (!session?.user?.id) throw new Error('User not authenticated')

  // Prices, stock and product details always come from the database.
  // An empty cart is valid while the customer is removing items.
  const items =
    clientItems.length === 0 ? [] : await buildOrderItems(clientItems)
  const parsedShippingAddress = shippingAddress
    ? ShippingAddressSchema.parse(shippingAddress)
    : undefined

  const {
    availableDeliveryDates: settingDeliveryDates,
    seller,
    common: { taxRate, taxInclusive },
  } = await getSetting()

  const pricedItems = priceOrderItems(items, taxRate, taxInclusive)
  const itemsPrice = round2(
    pricedItems.reduce((acc, item) => acc + item.price * item.quantity, 0)
  )

  const pickupLocation = [
    seller.street,
    seller.buildingNumber,
    seller.citySubdivision,
    seller.city,
  ]
    .filter(Boolean)
    .join(', ')
  const shippingQuotes = parsedShippingAddress
    ? await getShippingRates({
        country: parsedShippingAddress.country,
        region: parsedShippingAddress.province,
        city: parsedShippingAddress.city,
        items: pricedItems,
        itemsPrice,
        pickupLocation,
      })
    : []
  const deliveryOptions =
    shippingQuotes.length > 0
      ? shippingQuotes.map((quote) => ({
          name: quote.name,
          daysToDeliver: quote.etaMaxDays,
          shippingPrice: quote.shippingPrice,
          freeShippingMinPrice: 0,
        }))
      : settingDeliveryDates
  const availableDeliveryDates = deliveryOptions

  const requestedIndex =
    deliveryDateIndex === undefined
      ? shippingQuotes.length > 0
        ? 0
        : availableDeliveryDates.length - 1
      : deliveryDateIndex
  const resolvedIndex = Math.min(
    Math.max(0, requestedIndex),
    availableDeliveryDates.length - 1
  )

  if (!Number.isInteger(resolvedIndex))
    throw new Error('Invalid delivery date')

  const deliveryDate = availableDeliveryDates[resolvedIndex]
  if (!deliveryDate) throw new Error('Delivery date is not available')
  const selectedQuote = shippingQuotes[resolvedIndex]

  const hasItems = pricedItems.length > 0

  const shippingPrice = !hasItems
    ? 0
    : !shippingAddress
      ? undefined
      : selectedQuote
        ? selectedQuote.shippingPrice
        : deliveryDate.freeShippingMinPrice > 0 &&
            itemsPrice >= deliveryDate.freeShippingMinPrice
          ? 0
          : deliveryDate.shippingPrice

  const taxPrice = !hasItems
    ? 0
    : !shippingAddress
      ? undefined
      : round2(
          pricedItems.reduce((acc, item) => acc + (item.vatAmount ?? 0), 0)
        )

  const codFee =
    paymentMethod === 'Cash On Delivery' ? (selectedQuote?.codFee ?? 0) : 0
  const totalPrice = round2(
    itemsPrice +
      (shippingPrice ?? 0) +
      codFee +
      (taxInclusive ? 0 : (taxPrice ?? 0))
  )

  return {
    availableDeliveryDates,
    deliveryDateIndex: resolvedIndex,
    items: pricedItems,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    taxInclusive,
    taxRate,
    shippingRateId: selectedQuote?.id,
    shippingZone: selectedQuote?.zoneName,
    shippingCarrier: selectedQuote?.carrier,
    shippingService: selectedQuote?.serviceName,
    shippingEtaMin: selectedQuote?.etaMinDays,
    shippingEtaMax: selectedQuote?.etaMaxDays,
    isPickup: selectedQuote?.isPickup ?? false,
    pickupLocation: selectedQuote?.pickupLocation,
    codFee,
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
  const lowStockCount = await getLowStockCount()
  return {
    ordersCount,
    productsCount,
    usersCount,
    totalSales,
    lowStockCount,
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

    // Delete atomically so a payment that lands between the check and the
    // delete cannot remove a paid order.
    const res = await Order.findOneAndDelete({
      _id: id,
      isPaid: { $ne: true },
    })
    if (!res) {
      const stillExists = await Order.exists({ _id: id })
      if (!stillExists) throw new Error('Order not found')
      return {
        success: false,
        message:
          'Paid orders cannot be deleted. Keep them for accounting and order history.',
      }
    }

    try {
      await releaseStockReservation(id, true)
    } catch (error) {
      console.error(
        'Order deleted, but releasing its stock failed:',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
   
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
    const session = await auth()
    requireAdmin(session)

    await connectToDatabase()

    const order = await dbOrderWith3UserKeys(orderId)
    if (!order) throw new Error('Order not found')
    if (order.isPaid)
      return { success: true, message: 'Order is already paid' }
    if (order.isCancelled) throw new Error('Order is cancelled')
    if (order.paymentMethod !== 'Cash On Delivery')
      throw new Error(
        'Only cash-on-delivery orders can be marked paid manually'
      )

    await fulfillOrder({
      orderId,
      provider: order.paymentMethod,
      paymentId: order.paymentResult?.id || `manual-cod-${Date.now()}`,
      amountPaid: order.totalPrice,
      currency: order.currency || 'USD',
      email: order.user?.email ?? '',
      status: 'COMPLETED',
      actorId: session?.user?.id,
      actorEmail: session?.user?.email ?? '',
    })

    await revalidateAllLocales(`/account/orders/${orderId}`)
    await revalidateAllLocales(`/admin/orders/${orderId}`)
    await revalidateAllLocales('/admin/orders')

    return { success: true, message: 'Order paid successfully' }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

// MARK AS SHIPPED - ADMIN
export async function shipOrder(
  orderId: string,
  trackingNumber: string,
  trackingUrl?: string
) {
  try {
    const session = await auth()
    if (session?.user.role !== 'admin')
      throw new Error('Admin permission required')

    const tracking = trackingNumber?.trim()
    if (!tracking || tracking.length > 100)
      throw new Error('A valid tracking number is required')
    const trackingLink = trackingUrl?.trim()
    if (trackingLink) {
      let parsed: URL
      try {
        parsed = new URL(trackingLink)
      } catch {
        throw new Error('Tracking URL must be a valid URL')
      }
      if (!['http:', 'https:'].includes(parsed.protocol))
        throw new Error('Tracking URL must use http or https')
    }

    await connectToDatabase()
    const order = await dbOrderWith3UserKeys(orderId)
    if (!order) throw new Error('Order not found')
    if (order.isCancelled) throw new Error('Order is cancelled')
    if (!order.isPaid) throw new Error('Order is not paid')
    if (order.isDelivered) throw new Error('Order is already delivered')
    if (order.isPickup)
      throw new Error('Pickup orders do not require a shipment')

    const provider = getShippingProvider('manual')
    if (!provider) throw new Error('Shipping provider is unavailable')
    const shipment = await provider.createShipment({
      orderId,
      trackingNumber: tracking,
      trackingUrl: trackingLink || undefined,
    })

    order.status = 'shipped'
    order.statusHistory = [
      ...(order.statusHistory ?? []),
      {
        status: 'shipped',
        at: new Date(),
        note: `Tracking ${shipment.trackingNumber}`,
        actorId: session.user.id,
        actorEmail: session.user.email ?? '',
      },
    ]
    order.shipment = {
      provider: shipment.provider,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      shippedAt: new Date(),
      status: shipment.status,
    }
    await order.save()

    try {
      if (order.user?.email) await sendOrderShippedEmail({ order })
    } catch (error) {
      console.error(
        'Order shipped, but shipment email failed:',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }

    await revalidateAllLocales(`/account/orders/${orderId}`)
    await revalidateAllLocales(`/admin/orders/${orderId}`)
    await revalidateAllLocales('/admin/orders')
    return { success: true, message: 'Order marked as shipped' }
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
    if (order.isCancelled) throw new Error('Cancelled orders cannot be delivered')
    if (!order.isPaid) throw new Error('Order is not paid')
    if (order.isDelivered)
      return { success: true, message: 'Order is already delivered' }
    if (!order.isPickup && !order.shipment?.trackingNumber)
      throw new Error('Mark the order as shipped before delivery')

    order.isDelivered = true
    order.deliveredAt = new Date()
    order.status = 'delivered'
    order.statusHistory = [
      ...(order.statusHistory ?? []),
      {
        status: 'delivered',
        at: new Date(),
        note: 'Delivered',
        actorId: session.user.id,
        actorEmail: session.user.email ?? '',
      },
    ]
    if (order.shipment) {
      order.shipment.deliveredAt = new Date()
      order.shipment.status = 'delivered'
    }

    await order.save()

    try {
      if (order.user?.email) await sendAskReviewOrderItems({ order })
    } catch (error) {
      console.error(
        'Delivered order saved, but review email failed:',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  
    await revalidateAllLocales(`/account/orders/${orderId}`)
    await revalidateAllLocales(`/admin/orders/${orderId}`)
    await revalidateAllLocales('/admin/orders')

    return { success: true, message: 'Order delivered successfully' }
    
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}


