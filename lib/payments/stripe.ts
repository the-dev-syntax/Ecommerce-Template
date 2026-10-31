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

export async function listStripeRefunds(paymentIntentId: string) {
  return getStripeClient().refunds.list({
    payment_intent: paymentIntentId,
    limit: 20,
  })
}

export async function retrieveStripeRefund(id: string) {
  return getStripeClient().refunds.retrieve(id)
}

export async function refundStripePayment(input: {
  paymentIntentId: string
  amount: number
  idempotencyKey: string
}) {
  return getStripeClient().refunds.create(
    {
      payment_intent: input.paymentIntentId,
      amount: Math.round(input.amount * 100),
      reason: 'requested_by_customer',
      metadata: { recovery: 'fulfillment_failed' },
    },
    { idempotencyKey: input.idempotencyKey }
  )
}

export function constructStripeWebhook(
  payload: string,
  signature: string,
  secret: string
) {
  return getStripeClient().webhooks.constructEvent(payload, signature, secret)
}
