import { getTranslations } from 'next-intl/server'

import { getShippingRatesAdmin } from '@/lib/actions/shipping.actions'
import ShippingRateManager from './shipping-rate-manager'

export const dynamic = 'force-dynamic'

export default async function ShippingPage() {
  const t = await getTranslations()
  const rates = await getShippingRatesAdmin()

  return (
    <main className='max-w-6xl mx-auto space-y-4 p-4'>
      <div>
        <h1 className='h1-bold'>{t('Shipping Zones and Rates')}</h1>
        <p className='text-muted-foreground text-sm'>
          {t('Rates are resolved by country, region and city; city rules take priority over region and default rules')}
        </p>
      </div>
      <ShippingRateManager rates={rates} />
    </main>
  )
}
