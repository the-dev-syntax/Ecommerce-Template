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
    isConfigured: isMoyasarConfigured,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    label: 'Stripe',
    currencies: '*',
    supportsRefunds: true,
    webhookPath: '/api/webhooks/stripe',
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
