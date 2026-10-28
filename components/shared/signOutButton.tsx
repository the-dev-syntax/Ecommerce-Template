'use client' // This directive is crucial!

import { signOut } from 'next-auth/react'
import  useCartStore  from '@/hooks/use-cart-store'
import { useLocale, useTranslations } from 'next-intl'
import { redirect } from 'next/navigation'
import { localizedPath } from '@/lib/utils'
import { flushBrowsingHistoryNow } from '@/lib/sync-browsing-history'



export function SignOutButton() {
  const { clearCart } = useCartStore()
  const t = useTranslations()
  const locale = useLocale()

  // 2. Create the handler function
  const handleSignOut = async () => {    
    // Persist browsing history to the DB account before clearing the browser copy.
    await flushBrowsingHistoryNow()
    clearCart()
    localStorage.removeItem('EV-cart')
    localStorage.removeItem('browsingHistoryStore')
    sessionStorage.removeItem('browsingHistoryHydrated')

    await signOut()
    redirect(localizedPath(locale, '/'))
  }

  return (
    <span onClick={handleSignOut} style={{ cursor: 'pointer' }}>
     {t('Sign out')}
    </span>
  )
}