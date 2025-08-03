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
import { toast } from '@/hooks/use-toast'
import { UploadButton } from '@/lib/uploadthing'
import { ISettingInput } from '@/types'
import { TrashIcon } from 'lucide-react'
import Image from 'next/image'
import { useFieldArray, UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'


//? the setting object in DB is passed to be a default value of the form passed here
export default function CarouselForm({
  form,
  id,
}: {
  form: UseFormReturn<ISettingInput>
  id: string
}) {
  // should add translation to the FormField name= and   {errors.carousels?.[index]?.title?.message}
  // by translating the error messages in SettingInputSchema validator file, add translation to Admin for all of them.
  const t = useTranslations('Admin')

  const { watch,  formState: { errors } } = form

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'carousels',
  })

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>{t('Carousels')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-4'>
          {fields.map((field, index) => (
            <div key={field.id} className='flex justify-between gap-1 w-full '>
              <FormField
                control={form.control}
                name={`carousels.${index}.title`}
                render={({ field }) => (
                  <FormItem>
                    {index == 0 && <FormLabel>{t('Title')}</FormLabel>}
                    <FormControl>
                      <Input {...field} placeholder={t('Title')} />
                    </FormControl>
                    <FormMessage>
                      {errors.carousels?.[index]?.title?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`carousels.${index}.url`}
                render={({ field }) => (
                  <FormItem>
                    {index == 0 && <FormLabel>{t('Url')}</FormLabel>}
                    <FormControl>
                      <Input {...field} placeholder={t('Url')} />
                    </FormControl>
                    <FormMessage>
                      {errors.carousels?.[index]?.url?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`carousels.${index}.buttonCaption`}
                render={({ field }) => (
                  <FormItem>
                    {index == 0 && <FormLabel>{t('Caption')}</FormLabel>}
                    <FormControl>
                      <Input {...field} placeholder={t('buttonCaption')} />
                    </FormControl>
                    <FormMessage>
                      {errors.carousels?.[index]?.buttonCaption?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <div>
                <FormField
                  control={form.control}
                  name={`carousels.${index}.image`}
                  render={({ field }) => (
                    <FormItem>
                      {index == 0 && <FormLabel>{t('Image')}</FormLabel>}

                      <FormControl>
                        <Input placeholder={t('Enter image url')} {...field} />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watch(`carousels.${index}.image`) && (
                  <Image
                    src={watch(`carousels.${index}.image`)}
                    alt='image'
                    className=' w-full object-cover object-center rounded-sm'
                    width={192}
                    height={68}
                  />
                )}
                {!watch(`carousels.${index}.image`) && (
                  <UploadButton
                    endpoint='imageUploader'
                    onClientUploadComplete={(res) => {
                      form.setValue(`carousels.${index}.image`, res[0].ufsUrl)
                    }}
                    onUploadError={(error: Error) => {
                      toast({
                        variant: 'destructive',
                        description: `ERROR! ${error.message}`,
                      })
                    }}
                  />
                )}
              </div>
              <div>
                {index == 0 && <div>{t('Action')}</div>}
                <Button
                  type='button'
                  disabled={fields.length === 1}
                  variant='outline'
                  className={index == 0 ? 'mt-2' : ''}
                  onClick={() => {
                    remove(index)
                  }}
                >
                  <TrashIcon className='w-4 h-4' />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type='button'
            variant={'outline'}
            onClick={() =>
              append({ url: '', title: '', image: '', buttonCaption: '' })
            }
          >
            {t('Add Carousel')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}