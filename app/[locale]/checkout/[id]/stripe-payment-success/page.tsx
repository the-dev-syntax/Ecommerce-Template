import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Stripe from 'stripe'

import { Button } from '@/components/ui/button'
import { getOrderById } from '@/lib/actions/order.actions'
import { getTranslations } from 'next-intl/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

// props:{ params, searchParams } both types are results of a promise 
export default async function SuccessPage(props: {
  params: Promise<{ id: string }> 
  searchParams: Promise<{ payment_intent: string }>
}) {
  const params = await props.params
  const t = await getTranslations('Form')
  const { id } = params

  const searchParams = await props.searchParams
  const order = await getOrderById(id)
  if (!order) notFound()

  const paymentIntent = await stripe.paymentIntents.retrieve(
    searchParams.payment_intent
  )
  
  if (
    paymentIntent.metadata.orderId == null ||
    paymentIntent.metadata.orderId !== order._id.toString()
  )
    return notFound()

  const isSuccess = paymentIntent.status === 'succeeded'
  if (!isSuccess) return redirect(`/checkout/${id}`)

  return (
    <div className='max-w-4xl w-full mx-auto space-y-8'>
      <div className='flex flex-col gap-6 items-center '>
        <h1 className='font-bold text-2xl lg:text-3xl'>
          {t('Thanks for your purchase')}
        </h1>
        <div>{t('We are now processing your order.')}</div>
        <Button asChild>
          <Link href={`/account/orders/${id}`}>{t('View order')}</Link>
        </Button>
      </div>
    </div>
  )
}