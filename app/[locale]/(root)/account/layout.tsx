import React from 'react'
import { SessionProvider } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { localizedPath } from '@/lib/utils'

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) {
    const locale = await getLocale()
    redirect(localizedPath(locale, '/sign-in'))
  }

  return (
    <div className=' flex-1 p-4'>
      <SessionProvider session={session}>
      <div className='max-w-5xl mx-auto space-y-4'>{children}</div>
      </SessionProvider>
    </div>
  )
}