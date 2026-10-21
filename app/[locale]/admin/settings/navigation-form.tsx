'use client'

import { UseFormReturn, useFieldArray } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { TrashIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ISettingInput } from '@/types'

function FooterGroupEditor({
  form,
  index,
  onRemove,
}: {
  form: UseFormReturn<ISettingInput>
  index: number
  onRemove: () => void
}) {
  const t = useTranslations()
  const { control } = form
  const { fields, append, remove } = useFieldArray({
    control,
    name: `navigation.footer.${index}.links`,
  })

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex items-end gap-2'>
        <FormField
          control={control}
          name={`navigation.footer.${index}.title`}
          render={({ field }) => (
            <FormItem className='w-full'>
              <FormLabel>{t('Group Title')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={onRemove}
        >
          <TrashIcon className='h-4 w-4' />
        </Button>
      </div>

      {fields.map((field, linkIndex) => (
        <div key={field.id} className='flex items-end gap-2'>
          <FormField
            control={control}
            name={`navigation.footer.${index}.links.${linkIndex}.name`}
            render={({ field: nameField }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Label')}</FormLabel>
                <FormControl>
                  <Input {...nameField} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`navigation.footer.${index}.links.${linkIndex}.href`}
            render={({ field: hrefField }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Link')}</FormLabel>
                <FormControl>
                  <Input {...hrefField} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => remove(linkIndex)}
          >
            <TrashIcon className='h-4 w-4' />
          </Button>
        </div>
      ))}

      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() => append({ name: '', href: '' })}
      >
        {t('Add link')}
      </Button>
    </div>
  )
}

export default function NavigationForm({
  form,
  id,
}: {
  form: UseFormReturn<ISettingInput>
  id: string
}) {
  const t = useTranslations()
  const { control } = form
  const header = useFieldArray({ control, name: 'navigation.header' })
  const footer = useFieldArray({ control, name: 'navigation.footer' })

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>{t('Navigation and Footer')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <FormLabel>{t('Header Menu')}</FormLabel>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => header.append({ name: '', href: '' })}
            >
              {t('Add link')}
            </Button>
          </div>
          {header.fields.map((field, index) => (
            <div key={field.id} className='flex items-end gap-2'>
              <FormField
                control={control}
                name={`navigation.header.${index}.name`}
                render={({ field: nameField }) => (
                  <FormItem className='w-full'>
                    <FormLabel>{t('Label')}</FormLabel>
                    <FormControl>
                      <Input {...nameField} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`navigation.header.${index}.href`}
                render={({ field: hrefField }) => (
                  <FormItem className='w-full'>
                    <FormLabel>{t('Link')}</FormLabel>
                    <FormControl>
                      <Input {...hrefField} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() => header.remove(index)}
              >
                <TrashIcon className='h-4 w-4' />
              </Button>
            </div>
          ))}
        </div>

        <Separator />

        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <FormLabel>{t('Footer Groups')}</FormLabel>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                footer.append({ title: '', links: [] })
              }
            >
              {t('Add group')}
            </Button>
          </div>
          {footer.fields.map((field, index) => (
            <FooterGroupEditor
              key={field.id}
              form={form}
              index={index}
              onRemove={() => footer.remove(index)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
