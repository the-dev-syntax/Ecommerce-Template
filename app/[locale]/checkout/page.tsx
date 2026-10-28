import CheckoutForm from './checkout-form'
import { auth } from '@/auth'
import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { localizedPath } from '@/lib/utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations()
  return {
    title: t('Checkout'),    
  }
}

export default async function CheckoutPage() {
  const session = await auth()
  if (!session?.user) {
    const locale = await getLocale()
    redirect(
      localizedPath(
        locale,
        `/sign-in?callbackUrl=${encodeURIComponent('/checkout')}`
      )
    )
  }
  return <CheckoutForm />
}
/*

export const metadata: Metadata = {
  title: 'Checkout',
}

*/
