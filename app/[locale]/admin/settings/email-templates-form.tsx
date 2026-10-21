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
import { EmailTemplateKey } from '@/lib/email-templates'
import { ISettingInput } from '@/types'

function TemplateCard({
  form,
  templateKey,
  title,
}: {
  form: UseFormReturn<ISettingInput>
  templateKey: EmailTemplateKey
  title: string
}) {
  const t = useTranslations()
  const { control } = form
  const base = `emailTemplates.${templateKey}` as const

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <FormField
          control={control}
          name={`${base}.subject`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Subject')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${base}.heading`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Heading')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${base}.intro`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Intro text')}</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${base}.footer`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Footer text')}</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
}

export default function EmailTemplatesForm({
  form,
  id,
}: {
  form: UseFormReturn<ISettingInput>
  id: string
}) {
  const t = useTranslations()

  return (
    <div id={id} className='space-y-4'>
      <h2 className='text-xl font-bold'>{t('Email Templates')}</h2>
      <TemplateCard
        form={form}
        templateKey='receipt'
        title={t('Order receipt')}
      />
      <TemplateCard
        form={form}
        templateKey='review'
        title={t('Review request')}
      />
      <TemplateCard
        form={form}
        templateKey='reset'
        title={t('Password reset')}
      />
      <TemplateCard
        form={form}
        templateKey='verification'
        title={t('Email verification')}
      />
      <p className='text-muted-foreground text-xs'>
        {t('Use {token}, {name}, {siteName} and {orderNumber} in subjects')}
      </p>
    </div>
  )
}
