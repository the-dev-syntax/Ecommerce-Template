'use client'

import { Printer } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

export default function PrintButton() {
  const t = useTranslations()

  return (
    <Button
      type='button'
      variant='outline'
      className='print:hidden'
      onClick={() => window.print()}
    >
      <Printer className='mr-2 h-4 w-4' />
      {t('Print Invoice')}
    </Button>
  )
}
