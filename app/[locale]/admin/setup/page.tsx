import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getNoCachedSetting } from '@/lib/actions/setting.actions'
import { isMoyasarConfigured } from '@/lib/env'
import Product from '@/lib/db/models/product.model'
import { connectToDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const t = await getTranslations()
  const setting = await getNoCachedSetting()
  await connectToDatabase()
  const publishedProducts = await Product.countDocuments({ isPublished: true })
  const moyasarEnabled = setting.availablePaymentMethods.some(
    (method) => method.name === 'Moyasar'
  )
  const paymentReady =
    setting.availablePaymentMethods.length > 0 &&
    (!moyasarEnabled || isMoyasarConfigured())

  const steps = [
    {
      key: 'store',
      title: t('Store information'),
      done: Boolean(
        setting.site.name &&
          setting.site.email &&
          setting.site.phone &&
          setting.site.url
      ),
      href: '/admin/settings#setting-site-info',
      cta: t('Open settings'),
    },
    {
      key: 'brand',
      title: t('Brand and theme'),
      done: Boolean(setting.brand.logoDark && setting.brand.favicon),
      href: '/admin/settings#setting-brand',
      cta: t('Open settings'),
    },
    {
      key: 'seller',
      title: t('Seller and tax'),
      done: Boolean(
        setting.seller.legalNameEn &&
          setting.seller.vatNumber &&
          setting.seller.crNumber
      ),
      href: '/admin/settings#setting-seller',
      cta: t('Open settings'),
    },
    {
      key: 'localization',
      title: t('Languages and currencies'),
      done:
        setting.availableLanguages.length > 0 &&
        setting.availableCurrencies.length > 0,
      href: '/admin/settings#setting-languages',
      cta: t('Open settings'),
    },
    {
      key: 'shipping',
      title: t('Shipping and delivery'),
      done: setting.availableDeliveryDates.length > 0,
      href: '/admin/settings#setting-delivery-dates',
      cta: t('Open settings'),
    },
    {
      key: 'payment',
      title: t('Payment methods'),
      done: paymentReady,
      href: '/admin/settings#setting-payment-methods',
      cta: t('Open settings'),
    },
    {
      key: 'email',
      title: t('Email identity'),
      done: Boolean(setting.email.senderName && setting.email.senderEmail),
      href: '/admin/settings#setting-email',
      cta: t('Open settings'),
    },
    {
      key: 'product',
      title: t('First published product'),
      done: publishedProducts > 0,
      href: '/admin/products/create',
      cta: t('Create a product'),
    },
    {
      key: 'publish',
      title: t('Store is published'),
      done: !setting.common.isMaintenanceMode,
      href: '/admin/settings#setting-common',
      cta: t('Open settings'),
    },
  ]

  const completed = steps.filter((step) => step.done).length
  const progress = Math.round((completed / steps.length) * 100)

  return (
    <main className='max-w-4xl mx-auto space-y-6 p-4'>
      <div>
        <h1 className='h1-bold'>{t('Store Setup')}</h1>
        <p className='text-muted-foreground'>
          {t('Complete these steps before publishing your store')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {t('Setup progress')}: {completed}/{steps.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='h-3 w-full overflow-hidden rounded-full bg-muted'>
            <div
              className='h-full rounded-full bg-primary transition-all'
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className='text-muted-foreground mt-2 text-sm'>{progress}%</p>
        </CardContent>
      </Card>

      <div className='space-y-3'>
        {steps.map((step, index) => (
          <Card key={step.key}>
            <CardContent className='flex flex-wrap items-center justify-between gap-3 p-4'>
              <div className='flex items-center gap-3'>
                <span className='flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold'>
                  {index + 1}
                </span>
                <div>
                  <p className='font-medium'>{step.title}</p>
                  <Badge variant={step.done ? 'default' : 'secondary'}>
                    {step.done ? t('Complete') : t('Pending')}
                  </Badge>
                </div>
              </div>
              {!step.done && (
                <Button asChild variant='outline'>
                  <Link href={step.href}>{step.cta}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
