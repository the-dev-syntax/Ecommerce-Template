'use client' // This directive is crucial!

import { signOut } from 'next-auth/react'
import  useCartStore  from '@/hooks/use-cart-store'
import { useTranslations } from 'next-intl'
import { redirect } from 'next/navigation'



export function SignOutButton() {
  const { clearCart } = useCartStore()
  const t = useTranslations("Header")

  // 2. Create the handler function
  const handleSignOut = async () => {    
    clearCart()
    localStorage.removeItem('EV-cart')
    localStorage.removeItem('browsingHistoryStore')

    await signOut()
    redirect('/')
  }

  return (
    <span onClick={handleSignOut} style={{ cursor: 'pointer' }}>
     {t('Sign out')}
    </span>
  )
}