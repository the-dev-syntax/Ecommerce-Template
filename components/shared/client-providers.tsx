'use client'
import React, { Suspense } from 'react'
import useCartSidebar from '@/hooks/use-cart-sidebar'
import CartSidebar from './cart-sidebar'
import { Toaster } from '../ui/toaster'
import { ThemeProvider } from './theme-provider'
import SettingsInitializer from './settings-initializer'
import { ClientSetting } from '@/types'
import TopProgressBar from './top-progress-bar'
import SyncBrowsingHistory from './sync-browsing-history'
import CartOwnerSync from './cart-owner-sync'



export default function ClientProviders({
  children, 
  setting, 
  ownerId,
}: {
  children: React.ReactNode
  setting: ClientSetting
  ownerId?: string
}) {
  const visible = useCartSidebar()

  return (  
    <>
      <Suspense fallback={null}>
        <TopProgressBar />
      </Suspense>
      <SyncBrowsingHistory />
      <CartOwnerSync ownerId={ownerId} />

      <SettingsInitializer setting={setting}  />
      
        <ThemeProvider attribute='class' defaultTheme={setting.common.defaultTheme.toLocaleLowerCase()}>
          {visible ? (
            <div className='flex min-h-screen'>
              <div className='flex-1 overflow-hidden'>{children}</div>
              <CartSidebar />
            </div>
          ) : (
            <div>{children}</div>
          )}
          <Toaster />
        </ThemeProvider>
    </>
  )
}