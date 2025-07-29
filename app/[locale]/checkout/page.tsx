import CheckoutForm from './checkout-form'
import { auth } from '@/auth'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'


export async function generateMetadata() {
  const t = await getTranslations('Cart')
  return {
    title: t('Checkout'),    
  }
}

export default async function CheckoutPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/checkout') 
  }
  return <CheckoutForm />
}
/*

export const metadata: Metadata = {
  title: 'Checkout',
}

*/