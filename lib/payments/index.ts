import { isMoyasarConfigured } from '@/lib/env'

import type {
  PaymentProviderDefinition,
  PaymentProviderId,
} from './types'

export const paymentProviders: PaymentProviderDefinition[] = [
  {
    id: 'moyasar',
    name: 'Moyasar',
    label: 'Moyasar (Mada / Apple Pay / STC Pay)',
    currencies: '*',
    supportsRefunds: true,
    webhookPath: '/api/webhooks/moyasar',
    unifiedWebhookPath: '/api/webhooks/payments/moyasar',
    isConfigured: isMoyasarConfigured,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    label: 'Stripe',
    currencies: '*',
    supportsRefunds: true,
    webhookPath: '/api/webhooks/stripe',
    unifiedWebhookPath: '/api/webhooks/payments/stripe',
    isConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
  },
  {
    id: 'paypal',
    name: 'PayPal',
    label: 'PayPal',
    currencies: '*',
    supportsRefunds: true,
    isConfigured: () =>
      Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_APP_SECRET),
  },
  {
    id: 'cod',
    name: 'Cash On Delivery',
    label: 'Cash On Delivery',
    currencies: '*',
    supportsRefunds: false,
    isConfigured: () => true,
  },
  {
    id: 'mock',
    name: 'Mock Payment',
    label: 'Mock Payment (test only)',
    currencies: '*',
    supportsRefunds: true,
    webhookPath: '/api/webhooks/mock',
    unifiedWebhookPath: '/api/webhooks/payments/mock',
    isConfigured: () => process.env.NODE_ENV !== 'production',
  },
]

export function getPaymentProviderByName(
  name: string
): PaymentProviderDefinition | undefined {
  const normalized = name.trim().toLowerCase()
  return paymentProviders.find(
    (provider) =>
      provider.id === normalized || provider.name.toLowerCase() === normalized
  )
}

export function getPaymentProviderById(
  id: PaymentProviderId
): PaymentProviderDefinition | undefined {
  return paymentProviders.find((provider) => provider.id === id)
}

export function isPaymentProvider(name: string, id: PaymentProviderId) {
  return getPaymentProviderByName(name)?.id === id
}

export function getEnabledPaymentMethods<T extends { name: string }>(
  methods: T[],
  options: { cashOnDelivery?: boolean } = {}
): T[] {
  return methods.filter((method) => {
    const provider = getPaymentProviderByName(method.name)
    if (!provider) return true
    if (provider.id === 'cod' && options.cashOnDelivery === false) {
      return false
    }
    return provider.isConfigured()
  })
}
