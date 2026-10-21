import { paypal } from '@/lib/paypal'

import {
  fetchMoyasarPayment,
  isMoyasarPaid,
  refundMoyasarPayment,
  toMoyasarAmount,
  voidMoyasarPayment,
} from './moyasar'
import {
  createStripeIntent,
  retrieveStripeIntent,
} from './stripe'

export interface PaymentAdapter {
  createOrder?: (amount: number, currency: string) => Promise<{ id: string }>
  captureOrder?: (orderId: string) => Promise<Record<string, unknown>>
  createIntent?: (input: {
    amount: number
    currency: string
    orderId: string
    email?: string
  }) => Promise<unknown>
  retrieveIntent?: (id: string) => Promise<unknown>
  fetchPayment?: (id: string) => Promise<unknown>
  refund?: (id: string, amount?: number) => Promise<unknown>
  void?: (id: string) => Promise<unknown>
  isPaid?: (status: string) => boolean
  toSmallestUnit?: (amount: number) => number
}

export const paymentAdapters: Record<string, PaymentAdapter> = {
  stripe: {
    createIntent: createStripeIntent,
    retrieveIntent: retrieveStripeIntent,
  },
  paypal: {
    createOrder: (amount, currency) => paypal.createOrder(amount, currency),
    captureOrder: (orderId) => paypal.capturePayment(orderId),
  },
  moyasar: {
    fetchPayment: fetchMoyasarPayment,
    refund: refundMoyasarPayment,
    void: voidMoyasarPayment,
    isPaid: isMoyasarPaid,
    toSmallestUnit: toMoyasarAmount,
  },
  cod: {},
  mock: {},
}

export function getPaymentAdapter(name: string): PaymentAdapter | undefined {
  const normalized = name.trim().toLowerCase()
  return paymentAdapters[normalized]
}
