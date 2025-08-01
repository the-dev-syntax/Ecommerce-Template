import { getSetting } from '@/lib/actions/setting.actions'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { getTranslations } from 'next-intl/server'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations('Footer')
  const { site } = await getSetting()

  return (
    <div className='flex flex-col items-center min-h-screen highlight-link  '>
      <header className='mt-8'>
        <Link href='/'>
          <Image
            src={site.logo}
            alt='logo'
            width={64}
            height={64}
            priority
            style={{
              maxWidth: '100%',
              height: 'auto',
            }}
          />
        </Link>
      </header>
      <main className='mx-auto max-w-sm min-w-80 p-4'>{children}</main>
      <footer className=' flex-1 mt-8  bg-gray-800 w-full flex flex-col gap-4 items-center p-8 text-sm'>
        <div className='flex justify-center space-x-4'>
          <Link href='/page/conditions-of-use'> {t('Conditions of Use')} </Link>
          <Link href='/page/privacy-policy'> {t('Privacy Notice')} </Link>
          <Link href='/page/help'> {t('Help')} </Link>
        </div>
        <div>
          <p className='text-gray-400'>{site.copyright}</p>
        </div>
      </footer>
    </div>
  )
}