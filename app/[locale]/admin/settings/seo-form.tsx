'use client'

import { UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ISettingInput } from '@/types'

export default function SeoForm({
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
        <CardTitle>{t('SEO Defaults')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <FormField
          control={control}
          name='seo.titleTemplate'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Title Template')}</FormLabel>
              <FormControl>
                <Input placeholder='%s | Store Name' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='seo.defaultDescription'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Default Description')}</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={control}
            name='seo.ogImage'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Open Graph Image URL')}</FormLabel>
                <FormControl>
                  <Input placeholder='/og-preview.jpg' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='seo.twitterHandle'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Twitter Handle')}</FormLabel>
                <FormControl>
                  <Input placeholder='@store' {...field} />
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
