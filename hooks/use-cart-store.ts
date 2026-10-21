import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Cart, OrderItem, ShippingAddress } from '@/types'
import { calcDeliveryDateAndPrice } from '@/lib/actions/order.actions'

// explaination in readme


const initialState: Cart = {
  items: [],
  itemsPrice: 0,
  taxPrice: undefined,
  shippingPrice: undefined,
  shippingAddress: undefined,
  totalPrice: 0,
  paymentMethod: undefined,
  deliveryDateIndex: 0, // change it from undefined to 0
}

function sameLine(a: OrderItem, b: OrderItem) {
  if (a.variantId || b.variantId) {
    return a.product === b.product && a.variantId === b.variantId
  }
  return (
    a.product === b.product &&
    a.color === b.color &&
    a.size === b.size
  )
}

interface CartState {
  cart: Cart
  addItem: (item: OrderItem, quantity: number) => Promise<string>
  updateItem: (item: OrderItem, quantity: number) => Promise<void>
  removeItem: (item: OrderItem) => void
  clearCart: () => void
  setShippingAddress: (shippingAddress: ShippingAddress) => Promise<void>
  setPaymentMethod: (paymentMethod: string) => Promise<void>
  setDeliveryDateIndex: (index: number) => Promise<void>
}

const useCartStore = create(
  persist<CartState>(
    (set, get) => ({
      cart: initialState,

      addItem: async (item: OrderItem, quantity: number) => {
        const { items,shippingAddress } = get().cart
       
        const existItem = items.find((x) => sameLine(x, item))
       // if item exist with the same variant , existItem ={...item }
        if (existItem) {
          if (existItem.countInStock < quantity + existItem.quantity) {
            throw new Error('Not enough items in stock')
          }
        } else {
          if (item.countInStock < item.quantity) {
            throw new Error('Not enough items in stock')
          }
        }
        
        const updatedCartItems = existItem
          ? items.map((x) =>
              sameLine(x, item)
                ? { ...existItem, quantity: existItem.quantity + quantity }
                : x
            )
          : [...items, { ...item, quantity }]
          
        set({
          cart: {
            ...get().cart,
            ...(await calcDeliveryDateAndPrice({
              items: updatedCartItems,
              shippingAddress,
              paymentMethod: get().cart.paymentMethod,
            })),
          },
        })
        const foundItem = updatedCartItems.find((x) => sameLine(x, item))
        if (!foundItem) {
          throw new Error('Item not found in cart')
        }
        return foundItem.clientId
      },
      updateItem: async (item: OrderItem, quantity: number) => {
        const { items, shippingAddress } = get().cart
        const exist = items.find((x) => sameLine(x, item))
        if (!exist) return
        const updatedCartItems = items.map((x) =>
          sameLine(x, item) ? { ...exist, quantity: quantity } : x
        )
        set({
          cart: {
            ...get().cart,
            ...(await calcDeliveryDateAndPrice({
              items: updatedCartItems,
              shippingAddress,
              paymentMethod: get().cart.paymentMethod,
            })),
          },
        })
      },
      removeItem: async (item: OrderItem) => {
        const { items, shippingAddress } = get().cart
        const updatedCartItems = items.filter((x) => !sameLine(x, item))
        set({
          cart: {
            ...get().cart,
            ...(await calcDeliveryDateAndPrice({
              items: updatedCartItems,
              shippingAddress,
              paymentMethod: get().cart.paymentMethod,
            })),
          },
        })
      },
      init: () => set({ cart: initialState }),
      setShippingAddress: async (shippingAddress: ShippingAddress) => {
        const { items } = get().cart
        set({
          cart: {
            ...get().cart,
            shippingAddress,
            ...(await calcDeliveryDateAndPrice({
              items,
              shippingAddress,
              paymentMethod: get().cart.paymentMethod,
            })),
          },
        })
      },
      setPaymentMethod: async (paymentMethod: string) => {
        const { items, shippingAddress, deliveryDateIndex } = get().cart
        set({
          cart: {
            ...get().cart,
            paymentMethod,
            ...(await calcDeliveryDateAndPrice({
              items,
              shippingAddress,
              deliveryDateIndex,
              paymentMethod,
            })),
          },
        })
      },
      setDeliveryDateIndex: async (index: number) => {
        const { items, shippingAddress } = get().cart
  
        set({
          cart: {
            ...get().cart,
            ...(await calcDeliveryDateAndPrice({
              items,
              shippingAddress,
              deliveryDateIndex: index,
              paymentMethod: get().cart.paymentMethod,
            })),
          },
        })
      },
      clearCart: () => {
        set({ cart: initialState });
      },
    }),   
    
    {
      name: 'EV-cart',
    }
  )
)
export default useCartStore

