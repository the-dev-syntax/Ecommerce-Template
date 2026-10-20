import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ISettingInput } from '@/types'
import React from 'react'
import { UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'

export default function SellerForm({
  form,
  id,
}: {
  form: UseFormReturn<ISettingInput>
  id: string
}) {
  const t = useTranslations()
  const { control } = form

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>{t('Seller and Tax')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <FormField
          control={control}
          name='market'
          render={({ field }) => (
            <FormItem className='w-full md:w-1/2'>
              <FormLabel>{t('Market')}</FormLabel>
              <FormControl>
                <Select
                  value={field.value || 'SA'}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('Select a market')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='SA'>{t('Saudi Arabia')}</SelectItem>
                    <SelectItem value='US'>{t('United States')}</SelectItem>
                    <SelectItem value='CA'>{t('Canada')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <p className='text-muted-foreground text-xs'>
                {t('SaudiMarketDefaultHint')}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={control}
            name='seller.legalNameEn'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Legal Name (English)')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='seller.legalNameAr'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Legal Name (Arabic)')}</FormLabel>
                <FormControl>
                  <Input dir='rtl' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={control}
            name='seller.vatNumber'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('VAT Number')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='seller.crNumber'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('CR Number')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name='seller.nationalAddress'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('National Address')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={control}
            name='seller.email'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Seller Email')}</FormLabel>
                <FormControl>
                  <Input type='email' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='seller.phone'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Seller Phone')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={control}
            name='invoice.prefix'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Invoice Prefix')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={10} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='invoice.sequenceLength'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Invoice Sequence Length')}</FormLabel>
                <FormControl>
                  <Input type='number' min='4' max='10' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
