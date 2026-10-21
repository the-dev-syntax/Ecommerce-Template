
'use client'

import Image from 'next/image'
import { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import ImageUploader from '@/components/shared/upload/image-uploader'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { slugify } from '@/lib/utils'
import { IProductInputForm } from '@/types'
import { useTranslations } from 'next-intl'



interface ProductFormUIProps {
    form: UseFormReturn<IProductInputForm>;
    onSubmit: (values: IProductInputForm) => void;
    isSubmitting: boolean;
    type: 'Create' | 'Update';
}


 const ProductFormUI = ({ form, onSubmit, isSubmitting, type }: ProductFormUIProps) => {

  // const { toast } = useToast()
 
  const images = form.watch('images')
  const taxCategory = form.watch('taxCategory') ?? 'S'
  
  const t = useTranslations()
//   console.log(form.formState.errors)
  return (
    <Form {...form}>
      <form
        method='post'
        onSubmit={form.handleSubmit(onSubmit)}
        className='space-y-8'
      >
        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('Enter product name')} {...field} />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='slug'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Slug')}</FormLabel>

                <FormControl>
                  <div className='relative'>
                    <Input
                      placeholder={t('Enter product slug')}
                      className='pl-8'
                      {...field}
                    />
                    <button
                      type='button'
                      onClick={() => {
                        form.setValue('slug', slugify(form.getValues('name')))
                      }}
                      className='absolute right-2 top-2.5'
                    >
                      {t('Generate')}
                    </button>
                  </div>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={form.control}
            name='category'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Category')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('Enter category')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='brand'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Brand')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('Enter product brand')} {...field} />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={form.control}
            name='listPrice'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('List Price')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('Enter product list price')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='price'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Price (VAT included)')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('Enter product price')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='countInStock'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Count In Stock')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    placeholder={t('Enter product count in stock')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={form.control}
            name='taxCategory'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('VAT Category')}</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? 'S'}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('Select a VAT category')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='S'>{t('Taxable (15%)')}</SelectItem>
                      <SelectItem value='Z'>{t('Zero-rated')}</SelectItem>
                      <SelectItem value='E'>{t('Exempt')}</SelectItem>
                      <SelectItem value='O'>{t('Out of scope')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  {t('Only taxable products include VAT')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {taxCategory !== 'S' && (
            <FormField
              control={form.control}
              name='exemptionReasonCode'
              render={({ field }) => (
                <FormItem className='w-full'>
                  <FormLabel>{t('Exemption Reason Code')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('Enter exemption reason code')}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={form.control}
            name='returnPolicy'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Return policy')}</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? 'return_and_refund'}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('Select a return policy')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='return_and_refund'>
                        {t('Return and refund')}
                      </SelectItem>
                      <SelectItem value='refund_only'>
                        {t('Refund only')}
                      </SelectItem>
                      <SelectItem value='final_sale'>
                        {t('Final sale')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  {t('Final sale items cannot be returned or refunded')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={form.control}
            name='images'
            render={() => (
              <FormItem className='w-full'>
                <FormLabel>{t('Images')}</FormLabel>
                <Card>
                  <CardContent className='space-y-2 mt-2 min-h-48'>
                    <div className='flex justify-start items-center space-x-2'>
                      {images.map((image: string) => (
                        <Image
                          key={image}
                          src={image}
                          alt={t('product image')}
                          className='w-20 h-20 object-cover object-center rounded-sm'
                          width={100}
                          height={100}
                        />
                      ))}
                    <FormControl className="flex-grow flex items-center justify-center">
                        
                      <ImageUploader
                        existingImages={images}
                        onUploaded={(urls) => form.setValue('images', [...images, ...urls])}
                      />
                    </FormControl>
                    </div>
                  </CardContent>
                </Card>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <FormField
            control={form.control}
            name='description'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{t('Description')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('Tell us a little bit about yourself')}
                    className='resize-none'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('To link to a user or organization, type @ followed by their name')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div>
          <FormField
            control={form.control}
            name='isPublished'
            render={({ field }) => (
              <FormItem className='space-x-2 items-center'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                    <div className='space-y-1 leading-none'>
                        <FormLabel>
                        {t('Publish Product')}
                        </FormLabel>
                        <FormDescription>
                        {t('Make this product visible to customers')}
                        </FormDescription>
                    </div>
              </FormItem>
            )}
          />
        </div>
        <div>
        <Button type='submit' size='lg' disabled={isSubmitting} className='button col-span-2 w-full'>
            {isSubmitting ? t('Submitting') : `${type} Product `}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default ProductFormUI

