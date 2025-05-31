import { OrderItem, ShippingAddress } from '@/types'
import { round2 } from '../utils'
import { AVAILABLE_DELIVERY_DATES } from '../constants'

export const calcDeliveryDateAndPrice = async ({
    items,
    shippingAddress,
    deliveryDateIndex
  }: {
    deliveryDateIndex?: number
    items: OrderItem[]
    shippingAddress?:ShippingAddress
  }) => {
    const itemsPrice = round2(
      items.reduce((acc, item) => acc + item.price * item.quantity, 0)
    )
    // get index of the AVAILABLE_DELIVERY_DATES to return object of that choice from constant.
    const deliveryDate =
    AVAILABLE_DELIVERY_DATES[
      deliveryDateIndex === undefined
        ? AVAILABLE_DELIVERY_DATES.length - 1
        : deliveryDateIndex
    ]
    //if shippingAddress=false ==> !shippingAddress=ture, || won't work, immediately all the condition line = true(undefined).
    //so if you have value for shippingAdress ==> !shippingAddress=false , || will check the other side, !deliveryDate.
    // shippingAddress and deliveryDate has to be true so the result won't be undefined.
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
    AVAILABLE_DELIVERY_DATES,
    deliveryDateIndex:
      deliveryDateIndex === undefined
        ? AVAILABLE_DELIVERY_DATES.length - 1
        : deliveryDateIndex,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice  
  }
}

// no use server as all of them are utility function , used on server just cause they are computational
// use server used for files interacting with DB or auth (secure connection is needed)
/*
const shippingPrice = itemsPrice > FREE_SHIPPING_MIN_PRICE ? 0 : 5
  const taxPrice = round2(itemsPrice * 0.15)
  
  const totalPrice = round2(
    itemsPrice +
      (shippingPrice ? round2(shippingPrice) : 0) +
      (taxPrice ? round2(taxPrice) : 0)
  )
  return {
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice
*/
