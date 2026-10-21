'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'
import { SettingInputSchemaNoDefaults } from '@/lib/validator'
import { ClientSetting, ISettingInput } from '@/types'
import { updateSetting } from '@/lib/actions/setting.actions'
import useSetting from '@/hooks/use-setting-store'
import LanguageForm from './language-form'
import CurrencyForm from './currency-form'
import PaymentMethodForm from './payment-method-form'
import DeliveryDateForm from './delivery-date-form'
import SiteInfoForm from './site-info-form'
import SellerForm from './seller-form'
import CommonForm from './common-form'
import CarouselForm from './carousel-form'
import BrandForm from './brand-form'
import SeoForm from './seo-form'
import FeaturesForm from './features-form'
import NavigationForm from './navigation-form'
import EmailForm from './email-form'
import EmailTemplatesForm from './email-templates-form'



export default function SettingForm({ setting }: { setting: ISettingInput }) {
  const { setSetting } = useSetting()
  const t = useTranslations()

  const form = useForm<ISettingInput>({
    resolver: zodResolver(SettingInputSchemaNoDefaults),
    defaultValues: setting,
  })
  const {
    formState: { isSubmitting },
  } = form

  const { toast } = useToast()
  async function onSubmit(values: ISettingInput) {
    const res = await updateSetting({ ...values })
    if (!res.success) {
      toast({
        variant: 'destructive',
        description: res.message,
      })
    } else {
      toast({
        description: res.message,
      })
      setSetting(values as ClientSetting)
    }
  }

  return (
    <Form {...form}>
      <form
        className='space-y-4'
        method='post'
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <SiteInfoForm id='setting-site-info' form={form} />
        <BrandForm id='setting-brand' form={form} />
        <SeoForm id='setting-seo' form={form} />
        <SellerForm id='setting-seller' form={form} />
        <FeaturesForm id='setting-features' form={form} />
        <NavigationForm id='setting-navigation' form={form} />
        <EmailForm id='setting-email' form={form} />
        <EmailTemplatesForm id='setting-email-templates' form={form} />
        <CommonForm id='setting-common' form={form} />
        <CarouselForm id='setting-carousels' form={form} />

        <LanguageForm id='setting-languages' form={form} />

        <CurrencyForm id='setting-currencies' form={form} />

        <PaymentMethodForm id='setting-payment-methods' form={form} />

        <DeliveryDateForm id='setting-delivery-dates' form={form} />

        <div>
          <Button
            type='submit'
            size='lg'
            disabled={isSubmitting}
            className='w-full mb-24'
          >
            {isSubmitting ? t('Submitting') : t('Save Setting')}
          </Button>
        </div>
      </form>
    </Form>
  )
}

