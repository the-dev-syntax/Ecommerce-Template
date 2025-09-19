import React from 'react'

import Header from '@/components/shared/header'
import Footer from '@/components/shared/footer'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  return (
    <div className='flex flex-col min-h-screen'>
      <Header />
       <SessionProvider session={session}>
      <main className='flex-1 flex flex-col p-4'>{children}</main>
      </SessionProvider>
      <Footer />
    </div>
  )
}