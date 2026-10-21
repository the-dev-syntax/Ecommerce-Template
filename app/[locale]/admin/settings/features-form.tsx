'use client'

import { UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { ISettingInput } from '@/types'

export default function FeaturesForm({
  form,
  id,
}: {
  form: UseFormReturn<ISettingInput>
  id: string
}) {
  const t = useTranslations()
  const { control } = form

  const items = [
    {
      name: 'features.reviews' as const,
      label: t('Product Reviews'),
      description: t('Show product reviews and review forms'),
    },
    {
      name: 'features.browsingHistory' as const,
      label: t('Browsing History'),
      description: t('Show recently viewed products'),
    },
    {
      name: 'features.cashOnDelivery' as const,
      label: t('Cash On Delivery'),
      description: t('Allow customers to pay cash on delivery'),
    },
  ]

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>{t('Feature Flags')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {items.map((item) => (
          <FormField
            key={item.name}
            control={control}
            name={item.name}
            render={({ field }) => (
              <FormItem className='flex flex-row items-start gap-3 space-y-0'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className='space-y-1'>
                  <FormLabel>{item.label}</FormLabel>
                  <FormDescription>{item.description}</FormDescription>
                </div>
              </FormItem>
            )}
          />
        ))}
      </CardContent>
    </Card>
  )
}
