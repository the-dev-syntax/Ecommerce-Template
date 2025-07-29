import { HelpCircle } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { getTranslations } from 'next-intl/server'

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations('Cart')
  return (
    <div className='p-4'>
      <header className='bg-card mb-4 border-b'>
        <div className='max-w-6xl mx-auto flex justify-between items-center'>
          <Link href='/'>
            <Image
              src='/icons/EV_org-sky.svg'
              alt={t('Logo')}
              width={70}
              height={70}
              style={{
                maxWidth: '100%',
                height: 'auto',
              }}
            />
          </Link>
          <div>
            <h1 className='text-3xl'>{t('Checkout')}</h1>
          </div>
          <div>
            <Link href='/page/help'>
              <HelpCircle className='w-6 h-6' />
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}