'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { shipOrder } from '@/lib/actions/order.actions'

export default function ShipOrderForm({ orderId }: { orderId: string }) {
  const t = useTranslations()
  const router = useRouter()
  const { toast } = useToast()
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleShip = async () => {
    setIsSaving(true)
    const res = await shipOrder(orderId, trackingNumber, trackingUrl)
    setIsSaving(false)
    toast({
      description: res.message,
      variant: res.success ? 'default' : 'destructive',
    })
    if (res.success) {
      setTrackingNumber('')
      setTrackingUrl('')
      router.refresh()
    }
  }

  return (
    <div className='space-y-2 border-t pt-4'>
      <p className='font-bold'>{t('Mark as shipped')}</p>
      <div className='space-y-1'>
        <Label htmlFor='tracking-number'>{t('Tracking number')}</Label>
        <Input
          id='tracking-number'
          value={trackingNumber}
          maxLength={100}
          onChange={(event) => setTrackingNumber(event.target.value)}
        />
      </div>
      <div className='space-y-1'>
        <Label htmlFor='tracking-url'>{t('Tracking URL')}</Label>
        <Input
          id='tracking-url'
          value={trackingUrl}
          onChange={(event) => setTrackingUrl(event.target.value)}
        />
      </div>
      <Button
        type='button'
        className='w-full rounded-full'
        disabled={isSaving || !trackingNumber.trim()}
        onClick={handleShip}
      >
        {isSaving ? t('Saving') : t('Mark as shipped')}
      </Button>
    </div>
  )
}
