'use client'

import { UseFormReturn, useFieldArray } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { TrashIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { IProductInputForm } from '@/types'

export default function VariantForm({
  form,
  isEdit = false,
}: {
  form: UseFormReturn<IProductInputForm>
  isEdit?: boolean
}) {
  const t = useTranslations()
  const { control } = form
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants',
  })

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>{t('Variants')}</CardTitle>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            append({
              id: crypto.randomUUID(),
              sku: '',
              size: '',
              color: '',
              price: 0,
              listPrice: 0,
              countInStock: 0,
              image: '',
              barcode: '',
              weight: 0,
              isDefault: fields.length === 0,
            })
          }
        >
          {t('Add variant')}
        </Button>
      </CardHeader>
      <CardContent className='space-y-5'>
        <FormDescription>
          {t('Each variant has its own SKU, price and stock')}
        </FormDescription>

        {fields.map((field, index) => (
          <div key={field.id} className='space-y-3 rounded-md border p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                {t('Variant')} {index + 1}
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() => remove(index)}
              >
                <TrashIcon className='h-4 w-4' />
              </Button>
            </div>

            <div className='grid gap-3 md:grid-cols-3'>
              <FormField
                control={control}
                name={`variants.${index}.sku`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{t('SKU')}</FormLabel>
                    <FormControl>
                      <Input {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`variants.${index}.size`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{t('Size')}</FormLabel>
                    <FormControl>
                      <Input {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`variants.${index}.color`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{t('Color')}</FormLabel>
                    <FormControl>
                      <Input {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid gap-3 md:grid-cols-4'>
              <FormField
                control={control}
                name={`variants.${index}.price`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{t('Price (VAT included)')}</FormLabel>
                    <FormControl>
                      <Input type='number' step='0.01' {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`variants.${index}.listPrice`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{t('List Price')}</FormLabel>
                    <FormControl>
                      <Input type='number' step='0.01' {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`variants.${index}.countInStock`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{t('Count In Stock')}</FormLabel>
                    <FormControl>
                      <Input type='number' step='1' {...f} disabled={isEdit} />
                    </FormControl>
                    {isEdit && (
                      <FormDescription>
                        {t('Use Inventory to adjust existing stock')}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`variants.${index}.weight`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{t('Weight')}</FormLabel>
                    <FormControl>
                      <Input type='number' step='0.01' {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid gap-3 md:grid-cols-3'>
              <FormField
                control={control}
                name={`variants.${index}.image`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{t('Variant image URL')}</FormLabel>
                    <FormControl>
                      <Input {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`variants.${index}.barcode`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{t('Barcode')}</FormLabel>
                    <FormControl>
                      <Input {...f} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`variants.${index}.isDefault`}
                render={({ field: f }) => (
                  <FormItem className='flex flex-row items-center gap-2 space-y-0 pt-8'>
                    <FormControl>
                      <Checkbox
                        checked={f.value}
                        onCheckedChange={f.onChange}
                      />
                    </FormControl>
                    <FormLabel>{t('Default variant')}</FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </div>
        ))}

        {fields.length === 0 && (
          <FormDescription>
            {t('No variants yet, a default variant will be created on save')}
          </FormDescription>
        )}
      </CardContent>
    </Card>
  )
}
