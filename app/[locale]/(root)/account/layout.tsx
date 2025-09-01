import React from 'react'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  return (
    <div className=' flex-1 p-4'>
      <SessionProvider session={session}>
      <div className='max-w-5xl mx-auto space-y-4'>{children}</div>
      </SessionProvider>
    </div>
  )
}