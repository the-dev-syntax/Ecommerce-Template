'use client'

import { UseFormReturn, useFieldArray } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { TrashIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FONT_OPTIONS } from '@/lib/constants'
import { ISettingInput } from '@/types'

export default function BrandForm({
  form,
  id,
}: {
  form: UseFormReturn<ISettingInput>
  id: string
}) {
  const t = useTranslations()
  const { control } = form
  const brand = form.watch('brand')
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'brand.socialLinks',
  })

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>{t('Brand and Theme')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={control}
            name='brand.logoDark'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Dark Logo URL')}</FormLabel>
                <FormControl>
                  <Input placeholder='/icons/logo-dark.svg' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='brand.favicon'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Favicon URL')}</FormLabel>
                <FormControl>
                  <Input placeholder='/favicon.ico' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='brand.emailLogo'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Email Logo URL')}</FormLabel>
                <FormControl>
                  <Input placeholder='/icons/logo.svg' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={control}
            name='brand.primaryColor'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Primary Color')}</FormLabel>
                <FormControl>
                  <div className='flex gap-2'>
                    <Input
                      type='color'
                      className='h-10 w-14 p-1'
                      {...field}
                    />
                    <Input {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='brand.accentColor'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Accent Color')}</FormLabel>
                <FormControl>
                  <div className='flex gap-2'>
                    <Input
                      type='color'
                      className='h-10 w-14 p-1'
                      {...field}
                    />
                    <Input {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='brand.fontFamily'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Font Family')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FONT_OPTIONS.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        {font.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div
          className='rounded-md border p-4'
          style={{
            borderColor: brand?.primaryColor,
            background: `linear-gradient(90deg, ${brand?.primaryColor}22, ${brand?.accentColor}22)`,
          }}
        >
          <p className='font-semibold'>{t('Theme Preview')}</p>
          <div className='mt-2 flex gap-2'>
            <span
              className='rounded-full px-3 py-1 text-xs text-white'
              style={{ background: brand?.primaryColor }}
            >
              {t('Primary Color')}
            </span>
            <span
              className='rounded-full px-3 py-1 text-xs text-white'
              style={{ background: brand?.accentColor }}
            >
              {t('Accent Color')}
            </span>
          </div>
        </div>

        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <FormLabel>{t('Social Links')}</FormLabel>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => append({ name: '', url: '' })}
            >
              {t('Add link')}
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className='flex flex-col gap-2 md:flex-row'>
              <FormField
                control={control}
                name={`brand.socialLinks.${index}.name`}
                render={({ field: nameField }) => (
                  <FormItem className='w-full'>
                    <FormControl>
                      <Input
                        placeholder={t('Name')}
                        {...nameField}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`brand.socialLinks.${index}.url`}
                render={({ field: urlField }) => (
                  <FormItem className='w-full'>
                    <FormControl>
                      <Input
                        placeholder='https://'
                        {...urlField}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() => remove(index)}
              >
                <TrashIcon className='h-4 w-4' />
              </Button>
            </div>
          ))}
          {fields.length === 0 && (
            <FormDescription>{t('No social links yet')}</FormDescription>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
