'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import useCartStore from '@/hooks/use-cart-store'
import { updateOrderToPaidByMoyasar } from '@/lib/actions/order.actions'

export default function MoyasarPaymentSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const searchParams = useSearchParams()
  const paymentId = searchParams.get('id')

  const [orderId, setOrderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const { clearCart } = useCartStore()

  useEffect(() => {
    params.then((p) => setOrderId(p.id))
  }, [params])

  useEffect(() => {
    if (!orderId) return

    if (!paymentId) {
      setIsLoading(false)
      return
    }

    updateOrderToPaidByMoyasar(orderId, paymentId)
      .then((res) => {
        if (res.success) {
          clearCart()
        } else {
          setPaymentError(res.message)
        }
      })
      .catch(() => setPaymentError('An unexpected error occurred.'))
      .finally(() => setIsLoading(false))
  }, [clearCart, orderId, paymentId])

  if (isLoading) {
    return (
      <div className='max-w-4xl w-full mx-auto space-y-8'>
        <div className='flex flex-col gap-6 items-center py-12'>
          <Loader2 className='h-12 w-12 animate-spin text-primary' />
          <p>Processing your payment...</p>
        </div>
      </div>
    )
  }

  if (!paymentId) {
    return (
      <div className='max-w-4xl w-full mx-auto space-y-8'>
        <div className='flex flex-col gap-6 items-center py-12'>
          <XCircle className='h-16 w-16 text-destructive' />
          <h1 className='font-bold text-2xl lg:text-3xl'>Invalid Payment</h1>
          <p>No payment information found.</p>
          <Button asChild>
            <Link href='/'>Return to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (paymentError) {
    return (
      <div className='max-w-4xl w-full mx-auto space-y-8'>
        <div className='flex flex-col gap-6 items-center py-12'>
          <XCircle className='h-16 w-16 text-destructive' />
          <h1 className='font-bold text-2xl lg:text-3xl'>
            Payment Not Completed
          </h1>
          <p className='text-muted-foreground text-center'>{paymentError}</p>
          <div className='flex gap-4'>
            {orderId && (
              <Button asChild>
                <Link href={`/checkout/${orderId}`}>Try Again</Link>
              </Button>
            )}
            <Button variant='outline' asChild>
              <Link href='/'>Return to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-4xl w-full mx-auto space-y-8'>
      <div className='flex flex-col gap-6 items-center py-12'>
        <CheckCircle className='h-16 w-16 text-green-500' />
        <h1 className='font-bold text-2xl lg:text-3xl'>
          Thanks for your purchase!
        </h1>
        <p className='text-muted-foreground text-center'>
          We are now processing your order. You will receive a confirmation
          email shortly.
        </p>
        <div className='flex gap-4'>
          <Button asChild>
            <Link href={`/account/orders/${orderId}`}>View Order</Link>
          </Button>
          <Button variant='outline' asChild>
            <Link href='/'>Continue Shopping</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
