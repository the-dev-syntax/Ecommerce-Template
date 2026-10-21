import { getTranslations } from 'next-intl/server'

import { getInventoryOverview } from '@/lib/actions/inventory.actions'
import InventoryManager from './inventory-manager'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const t = await getTranslations()
  const data = await getInventoryOverview()

  return (
    <main className='mx-auto max-w-6xl space-y-4 p-4'>
      <div>
        <h1 className='h1-bold'>{t('Inventory')}</h1>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Review low-stock variants, adjust stock and audit every inventory change'
          )}
        </p>
      </div>
      <InventoryManager {...data} />
    </main>
  )
}
