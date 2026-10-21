import { connectToDatabase } from '@/lib/db'
import PaymentEvent, {
  type PaymentEventStatus,
} from '@/lib/db/models/payment-event.model'

export async function beginPaymentEvent(input: {
  provider: string
  eventId: string
  type: string
  orderId?: string
}) {
  await connectToDatabase()
  try {
    const event = await PaymentEvent.create({
      provider: input.provider,
      eventId: input.eventId,
      type: input.type,
      orderId: input.orderId ?? '',
      status: 'received',
      receivedAt: new Date(),
    })
    return { duplicate: false as const, event }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const existing = await PaymentEvent.findOne({
        provider: input.provider,
        eventId: input.eventId,
      })
      if (!existing) return { duplicate: true as const, event: null }

      const receivedAt = new Date(existing.receivedAt).getTime()
      const stale =
        Date.now() - receivedAt > 5 * 60 * 1000 &&
        existing.status === 'received'
      if (existing.status === 'failed' || stale) {
        const retried = await PaymentEvent.findOneAndUpdate(
          { _id: existing._id, status: existing.status },
          {
            $set: {
              status: 'received',
              receivedAt: new Date(),
              message: '',
            },
          },
          { new: true }
        )
        if (retried) return { duplicate: false as const, event: retried }
      }

      return { duplicate: true as const, event: null }
    }
    throw error
  }
}

export async function finishPaymentEvent(
  eventId: string,
  status: PaymentEventStatus,
  message = ''
) {
  if (!eventId) return
  await PaymentEvent.updateOne(
    { _id: eventId },
    { $set: { status, message } }
  )
}

export async function attachPaymentEventOrder(
  eventId: string,
  orderId: string
) {
  if (!eventId || !orderId) return
  await PaymentEvent.updateOne({ _id: eventId }, { $set: { orderId } })
}
