'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { TrashIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  deleteShippingRate,
  toggleShippingRate,
  upsertShippingRate,
} from '@/lib/actions/shipping.actions'
import type { IShippingRate, IShippingRateUpdate } from '@/types'
import { formatCurrency } from '@/lib/utils'

type Draft = IShippingRate & { _id?: string }

const emptyDraft: Draft = {
  zoneName: 'Saudi Arabia',
  country: 'Saudi Arabia',
  region: 'Riyadh',
  city: 'Riyadh',
  carrier: 'SMSA',
  serviceName: 'Express',
  baseRate: 20,
  includedWeightKg: 1,
  extraPerKg: 5,
  weightRoundingKg: 1,
  freeShippingEnabled: true,
  freeShippingMinPrice: 0,
  codFee: 10,
  remoteSurcharge: 0,
  etaMinDays: 1,
  etaMaxDays: 2,
  pickupAvailable: true,
  codAvailable: true,
  isActive: true,
  priority: 0,
}

const numberFields: { key: keyof IShippingRate; label: string; step?: string }[] = [
  { key: 'baseRate', label: 'Base rate', step: '0.01' },
  { key: 'includedWeightKg', label: 'Included weight (kg)', step: '0.1' },
  { key: 'extraPerKg', label: 'Extra per kg', step: '0.01' },
  { key: 'weightRoundingKg', label: 'Weight rounding (kg)', step: '0.1' },
  { key: 'freeShippingMinPrice', label: 'Free shipping threshold (0 = store default)', step: '0.01' },
  { key: 'codFee', label: 'COD fee', step: '0.01' },
  { key: 'remoteSurcharge', label: 'Remote surcharge', step: '0.01' },
  { key: 'etaMinDays', label: 'ETA min days', step: '1' },
  { key: 'etaMaxDays', label: 'ETA max days', step: '1' },
  { key: 'priority', label: 'Priority', step: '1' },
]

export default function ShippingRateManager({
  rates,
}: {
  rates: IShippingRateUpdate[]
}) {
  const t = useTranslations()
  const router = useRouter()
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    setIsSaving(true)
    const res = await upsertShippingRate(draft)
    setIsSaving(false)
    toast({
      description: res.message,
      variant: res.success ? 'default' : 'destructive',
    })
    if (res.success) {
      setDraft(emptyDraft)
      router.refresh()
    }
  }

  const remove = async (id: string) => {
    const res = await deleteShippingRate(id)
    toast({
      description: res.message,
      variant: res.success ? 'default' : 'destructive',
    })
    if (res.success) router.refresh()
  }

  const toggle = async (id: string, active: boolean) => {
    const res = await toggleShippingRate(id, active)
    toast({
      description: res.message,
      variant: res.success ? 'default' : 'destructive',
    })
    if (res.success) router.refresh()
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>
            {draft._id ? t('Edit shipping rate') : t('Add shipping rate')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='grid gap-3 md:grid-cols-4'>
            {(
              [
                ['zoneName', 'Zone name'],
                ['country', 'Country'],
                ['region', 'Region'],
                ['city', 'City'],
                ['carrier', 'Carrier'],
                ['serviceName', 'Service'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className='space-y-1'>
                <Label>{t(label)}</Label>
                <Input
                  value={String(draft[key] ?? '')}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value })
                  }
                />
              </div>
            ))}
          </div>

          <div className='grid gap-3 md:grid-cols-5'>
            {numberFields.map((field) => (
              <div key={field.key} className='space-y-1'>
                <Label>{t(field.label)}</Label>
                <Input
                  type='number'
                  step={field.step}
                  value={String(draft[field.key] ?? 0)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      [field.key]: Number(event.target.value),
                    })
                  }
                />
              </div>
            ))}
          </div>

          <p className='text-muted-foreground text-xs'>
            {t(
              'Free shipping per service and area help'
            )}
          </p>

          <div className='flex flex-wrap gap-4'>
            {(
              [
                ['freeShippingEnabled', 'Free shipping enabled'],
                ['pickupAvailable', 'Pickup available'],
                ['codAvailable', 'COD available'],
                ['isActive', 'Active'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className='flex items-center gap-2 text-sm'>
                <Checkbox
                  checked={Boolean(draft[key])}
                  onCheckedChange={(checked) =>
                    setDraft({ ...draft, [key]: Boolean(checked) })
                  }
                />
                {t(label)}
              </label>
            ))}
          </div>

          <div className='flex gap-2'>
            <Button type='button' onClick={save} disabled={isSaving}>
              {isSaving ? t('Saving') : t('Save shipping rate')}
            </Button>
            {draft._id && (
              <Button
                type='button'
                variant='outline'
                onClick={() => setDraft(emptyDraft)}
              >
                {t('Cancel')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Zones and rates')}</CardTitle>
        </CardHeader>
        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Zone')}</TableHead>
                <TableHead>{t('City')}</TableHead>
                <TableHead>{t('Carrier')}</TableHead>
                <TableHead>{t('Service')}</TableHead>
                <TableHead className='text-end'>{t('Rate')}</TableHead>
                <TableHead className='text-end'>{t('Free Shipping')}</TableHead>
                <TableHead className='text-end'>{t('ETA')}</TableHead>
                <TableHead>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate._id}>
                  <TableCell>
                    {rate.zoneName} / {rate.region}
                  </TableCell>
                  <TableCell>{rate.city}</TableCell>
                  <TableCell>{rate.carrier}</TableCell>
                  <TableCell>{rate.serviceName}</TableCell>
                  <TableCell className='text-end'>
                    {formatCurrency(rate.baseRate, 'SAR')}
                  </TableCell>
                  <TableCell className='text-end'>
                    {rate.freeShippingEnabled === false
                      ? '—'
                      : rate.freeShippingMinPrice > 0
                        ? `≥ ${formatCurrency(
                            rate.freeShippingMinPrice,
                            'SAR'
                          )}`
                        : t('Store default')}
                  </TableCell>
                  <TableCell className='text-end'>
                    {rate.etaMinDays}-{rate.etaMaxDays} {t('days')}
                  </TableCell>
                  <TableCell className='flex flex-wrap gap-1'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() =>
                        setDraft({
                          ...emptyDraft,
                          ...rate,
                          freeShippingEnabled:
                            rate.freeShippingEnabled !== false,
                        })
                      }
                    >
                      {t('Edit')}
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() =>
                        setDraft({
                          ...rate,
                          _id: undefined,
                          serviceName: `${rate.serviceName} copy`,
                        })
                      }
                    >
                      {t('Duplicate')}
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => toggle(rate._id, !rate.isActive)}
                    >
                      {rate.isActive ? t('Deactivate') : t('Activate')}
                    </Button>
                    <Button
                      size='icon'
                      variant='ghost'
                      onClick={() => remove(rate._id)}
                    >
                      <TrashIcon className='h-4 w-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
