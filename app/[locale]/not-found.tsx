'use client'
import React from 'react'

import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

export default function NotFound() {
  const t = useTranslations('NotFound')
  return (
    <div className='flex flex-col items-center justify-center min-h-screen '>
      <div className='p-6 rounded-lg shadow-md w-1/3 text-center'>
        <h1 className='text-3xl font-bold mb-4'>{t('Not Found')}</h1>
        <p className='text-destructive'>{t('Could not find requested resource')}</p>
        <Button
          variant='outline'
          className='mt-4 ml-2'
          onClick={() => (window.location.href = '/')}
        >
          {t('Back to home')}
        </Button>
      </div>
    </div>
  )
}