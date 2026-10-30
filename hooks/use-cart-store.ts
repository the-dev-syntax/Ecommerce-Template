import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Cart, OrderItem, ShippingAddress } from '@/types'
import {
  calcDeliveryDateAndPrice,
  getAvailableCartItemIds,
} from '@/lib/actions/order.actions'

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

// Every mutator reprices the cart through a server action. Two rapid changes
// (e.g. quantity + shipping speed) used to run concurrently and the slower
// response overwrote the newer one, so the cart silently reverted to stale
// prices. Serialize the mutations: each task reads `get()` when it actually
// runs, after the previous one has settled.
let mutationQueue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(task, task)
  mutationQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

interface CartState {
  cart: Cart
  // Signed-in user that owns the persisted cart. Used to stop a shared browser
  // from handing one customer's items, address and phone to the next account.
  ownerId?: string
  addItem: (item: OrderItem, quantity: number) => Promise<string>
  updateItem: (item: OrderItem, quantity: number) => Promise<void>
  removeItem: (item: OrderItem) => Promise<void>
  clearCart: () => void
  setCartOwner: (ownerId?: string) => void
  setShippingAddress: (shippingAddress: ShippingAddress) => Promise<void>
  setPaymentMethod: (paymentMethod: string) => Promise<void>
  setDeliveryDateIndex: (index: number) => Promise<void>
  refreshCart: () => Promise<void>
}

const useCartStore = create(
  persist<CartState>(
    (set, get) => ({
      cart: initialState,
      ownerId: undefined,

      addItem: (item: OrderItem, quantity: number) =>
        enqueue(async () => {
          const { items, shippingAddress, deliveryDateIndex } = get().cart

          const existItem = items.find((x) => sameLine(x, item))
          // if item exist with the same variant , existItem ={...item }
          if (existItem) {
            if (existItem.countInStock < quantity + existItem.quantity) {
              throw new Error('Not enough items in stock')
            }
          } else {
            if (item.countInStock < quantity) {
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
                deliveryDateIndex,
                paymentMethod: get().cart.paymentMethod,
              })),
            },
          })
          const foundItem = updatedCartItems.find((x) => sameLine(x, item))
          if (!foundItem) {
            throw new Error('Item not found in cart')
          }
          return foundItem.clientId
        }),
      updateItem: (item: OrderItem, quantity: number) =>
        enqueue(async () => {
          const { items, shippingAddress, deliveryDateIndex } = get().cart
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
                deliveryDateIndex,
                paymentMethod: get().cart.paymentMethod,
              })),
            },
          })
        }),
      removeItem: (item: OrderItem) =>
        enqueue(async () => {
          const { items, shippingAddress, deliveryDateIndex } = get().cart
          const updatedCartItems = items.filter((x) => !sameLine(x, item))
          set({
            cart: {
              ...get().cart,
              ...(await calcDeliveryDateAndPrice({
                items: updatedCartItems,
                shippingAddress,
                deliveryDateIndex,
                paymentMethod: get().cart.paymentMethod,
              })),
            },
          })
        }),
      refreshCart: () =>
        enqueue(async () => {
          const { items, shippingAddress, deliveryDateIndex, paymentMethod } =
            get().cart
          if (items.length === 0) return
          try {
            // Drop lines whose product/variant was unpublished or deleted before
            // repricing, otherwise a stale persisted cart blocks checkout with
            // "Product is no longer available" forever.
            const available = await getAvailableCartItemIds(items)
            const availableIds = new Set(available)
            const pruned = items.filter((item) =>
              availableIds.has(item.clientId)
            )

            if (pruned.length === 0) {
              set({ cart: { ...initialState } })
              return
            }

            if (pruned.length !== items.length) {
              set({ cart: { ...get().cart, items: pruned } })
            }

            set({
              cart: {
                ...get().cart,
                ...(await calcDeliveryDateAndPrice({
                  items: pruned,
                  shippingAddress,
                  deliveryDateIndex,
                  paymentMethod,
                })),
              },
            })
          } catch (error) {
            // Keep the local cart visible even if the database is unreachable;
            // the next quantity change will surface the error.
            console.error('Unable to refresh cart prices:', error)
          }
        }),
      setCartOwner: (ownerId?: string) => {
        const { cart, ownerId: currentOwner } = get()
        if (currentOwner === ownerId) return
        // Clear only when a different signed-in account takes over the
        // browser. Guest -> signed-in keeps the cart (the cart survives the
        // sign-in round-trip by design).
        if (currentOwner && ownerId && currentOwner !== ownerId) {
          set({ cart: { ...initialState }, ownerId })
          return
        }
        set({ ownerId })
      },
      setShippingAddress: (shippingAddress: ShippingAddress) =>
        enqueue(async () => {
          const { items, deliveryDateIndex } = get().cart
          set({
            cart: {
              ...get().cart,
              shippingAddress,
              ...(await calcDeliveryDateAndPrice({
                items,
                shippingAddress,
                deliveryDateIndex,
                paymentMethod: get().cart.paymentMethod,
              })),
            },
          })
        }),
      setPaymentMethod: (paymentMethod: string) =>
        enqueue(async () => {
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
        }),
      setDeliveryDateIndex: (index: number) =>
        enqueue(async () => {
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
        }),
      clearCart: () => {
        set({ cart: initialState, ownerId: undefined })
      },
    }),

    {
      name: 'EV-cart',
    }
  )
)
export default useCartStore
