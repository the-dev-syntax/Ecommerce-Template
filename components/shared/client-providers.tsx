'use client'
import React from 'react'
import useCartSidebar from '@/hooks/use-cart-sidebar'
import CartSidebar from './cart-sidebar'
import { Toaster } from '../ui/toaster'
import { ThemeProvider } from './theme-provider'
import SettingsInitializer from './settings-initializer'
import { ClientSetting } from '@/types'



export default function ClientProviders({
  children, 
  setting, 
}: {
  children: React.ReactNode
  setting: ClientSetting
}) {
  const visible = useCartSidebar()

  return (  
    <>
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