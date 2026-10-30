import CheckoutForm from './checkout-form'
import { auth } from '@/auth'
import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { localizedPath } from '@/lib/utils'
import { getUserAddresses } from '@/lib/actions/address.actions'
import { getVerifiedPhones } from '@/lib/actions/phone.actions'

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
  const savedAddresses = await getUserAddresses()
  const verifiedPhones = await getVerifiedPhones()
  return (
    <CheckoutForm
      savedAddresses={savedAddresses}
      verifiedPhones={verifiedPhones}
    />
  )
}
/*

export const metadata: Metadata = {
  title: 'Checkout',
}

*/
