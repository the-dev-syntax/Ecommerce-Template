import Stripe from 'stripe'

export function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('Stripe is not configured: STRIPE_SECRET_KEY missing')
  return new Stripe(secret)
}

export async function createStripeIntent(input: {
  amount: number
  currency: string
  orderId: string
  email?: string
}) {
  const stripe = getStripeClient()
  return stripe.paymentIntents.create({
    amount: Math.round(input.amount * 100),
    currency: input.currency.toLowerCase(),
    metadata: { orderId: input.orderId },
    receipt_email: input.email || undefined,
    description: `Order ${input.orderId}`,
  })
}

export async function retrieveStripeIntent(id: string) {
  return getStripeClient().paymentIntents.retrieve(id)
}

export async function retrieveStripeCharge(id: string) {
  return getStripeClient().charges.retrieve(id)
}

export function constructStripeWebhook(
  payload: string,
  signature: string,
  secret: string
) {
  return getStripeClient().webhooks.constructEvent(payload, signature, secret)
}
