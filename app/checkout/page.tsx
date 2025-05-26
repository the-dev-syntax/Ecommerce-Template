import { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Checkout',
}

export default async function CheckoutPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/checkout') // redirect to sign-in pg, after successful login callbackUrl=/checkout go to checkout pg
  }
  return <div>Checkout Form</div>
}