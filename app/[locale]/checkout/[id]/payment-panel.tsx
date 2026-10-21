'use client'

import { useState } from 'react'
import {
  PayPalButtons,
  PayPalScriptProvider,
  usePayPalScriptReducer,
} from '@paypal/react-paypal-js'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getPaymentProviderByName } from '@/lib/payments'
import {
  approvePayPalOrder,
  createPayPalOrder,
  createStripePaymentIntent,
} from '@/lib/actions/order.actions'
import type { IOrder } from '@/lib/db/models/order.model'

import MoyasarForm from './moyasar-form'
import StripeForm from './stripe-form'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string
)

export interface PaymentPanelProps {
  order: IOrder
  paypalClientId: string
  moyasarPublishableKey: string
  onPaid: () => void
}

function StripePanel({ order }: PaymentPanelProps) {
  const t = useTranslations()
  const { toast } = useToast()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (isCreating) return
    setIsCreating(true)
    const res = await createStripePaymentIntent(order._id)
    setIsCreating(false)
    if ('error' in res) {
      return toast({ description: res.error, variant: 'destructive' })
    }
    setClientSecret(res.clientSecret)
  }

  if (clientSecret) {
    return (
      <Elements options={{ clientSecret }} stripe={stripePromise}>
        <StripeForm
          priceInCents={Math.round(order.totalPrice * 100)}
          orderId={order._id}
        />
      </Elements>
    )
  }

  return (
    <Button
      className='w-full rounded-full'
      onClick={handleCreate}
      disabled={isCreating}
    >
      {isCreating ? t('Submitting') : t('Stripe Checkout')}
    </Button>
  )
}

function PayPalLoadingState() {
  const [{ isPending, isRejected }] = usePayPalScriptReducer()
  const t = useTranslations()
  if (isPending) return <>{t('Loading PayPal')}</>
  if (isRejected) return <>{t('Error in loading PayPal.')}</>
  return null
}

function PayPalPanel({
  order,
  paypalClientId,
  onPaid,
}: PaymentPanelProps) {
  const { toast } = useToast()

  const createOrder = async () => {
    const res = await createPayPalOrder(order._id)
    if (!res.success) {
      toast({ description: res.message, variant: 'destructive' })
      throw new Error(res.message)
    }
    if (!res.data) throw new Error('PayPal order reference is missing')
    return res.data
  }

  const approveOrder = async (data: { orderID: string }) => {
    const res = await approvePayPalOrder(order._id, data)
    toast({
      description: res.message,
      variant: res.success ? 'default' : 'destructive',
    })
    if (res.success) onPaid()
  }

  return (
    <PayPalScriptProvider options={{ clientId: paypalClientId }}>
      <PayPalLoadingState />
      <PayPalButtons createOrder={createOrder} onApprove={approveOrder} />
    </PayPalScriptProvider>
  )
}

function CodPanel({ order }: PaymentPanelProps) {
  const router = useRouter()
  const t = useTranslations()
  return (
    <Button
      className='w-full rounded-full'
      onClick={() => router.push(`/account/orders/${order._id}`)}
    >
      {t('View Order')}
    </Button>
  )
}

const panels: Record<
  string,
  (props: PaymentPanelProps) => React.ReactNode
> = {
  moyasar: (props) => (
    <MoyasarForm
      order={props.order}
      publishableKey={props.moyasarPublishableKey}
    />
  ),
  stripe: (props) => <StripePanel {...props} />,
  paypal: (props) => <PayPalPanel {...props} />,
  cod: (props) => <CodPanel {...props} />,
  mock: (props) => <CodPanel {...props} />,
}

export default function PaymentPanel(props: PaymentPanelProps) {
  const provider = getPaymentProviderByName(props.order.paymentMethod)
  const Panel = provider ? panels[provider.id] : undefined
  return Panel ? <>{Panel(props)}</> : null
}
