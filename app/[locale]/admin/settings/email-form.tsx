'use client'

import { UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ISettingInput } from '@/types'

export default function EmailForm({
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
        <CardTitle>{t('Email Identity')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={control}
            name='email.senderName'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Sender Name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('Store name')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='email.senderEmail'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Sender Email')}</FormLabel>
                <FormControl>
                  <Input placeholder='orders@store.com' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='email.replyTo'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Reply-To')}</FormLabel>
                <FormControl>
                  <Input placeholder='support@store.com' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormDescription>
          {t('Falls back to SENDER_NAME and SENDER_EMAIL when empty')}
        </FormDescription>
      </CardContent>
    </Card>
  )
}
