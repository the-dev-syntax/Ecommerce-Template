'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import useCartStore from '@/hooks/use-cart-store'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function StripePaymentSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const searchParams = useSearchParams()
  const paymentIntent = searchParams.get('payment_intent')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { clearCart } = useCartStore()

  useEffect(() => {
    // Get the order ID from params
    params.then((p) => {
      setOrderId(p.id)
      setIsLoading(false)
    })
  }, [params])

  useEffect(() => {
    // Clear the cart after successful payment
    if (paymentIntent) {
      clearCart()
    }
  }, [paymentIntent, clearCart])

  if (isLoading) {
    return (
      <div className="max-w-4xl w-full mx-auto space-y-8">
        <div className="flex flex-col gap-6 items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p>Processing your payment...</p>
        </div>
      </div>
    )
  }

  if (!paymentIntent) {
    return (
      <div className="max-w-4xl w-full mx-auto space-y-8">
        <div className="flex flex-col gap-6 items-center py-12">
          <h1 className="font-bold text-2xl lg:text-3xl">Invalid Payment</h1>
          <p>No payment information found.</p>
          <Button asChild>
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl w-full mx-auto space-y-8">
      <div className="flex flex-col gap-6 items-center py-12">
        <CheckCircle className="h-16 w-16 text-green-500" />
        <h1 className="font-bold text-2xl lg:text-3xl">
          Thanks for your purchase!
        </h1>
        <p className="text-muted-foreground text-center">
          We are now processing your order. You will receive a confirmation email shortly.
        </p>
        <div className="flex gap-4">
          <Button asChild>
            <Link href={`/account/orders/${orderId}`}>View Order</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
