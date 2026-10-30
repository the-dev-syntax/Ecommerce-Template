import { Link } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'

import { getUserAddresses } from '@/lib/actions/address.actions'
import { getVerifiedPhones } from '@/lib/actions/phone.actions'
import AddressBook from './address-book'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations()
  return { title: t('Addresses') }
}

export default async function AddressesPage() {
  const t = await getTranslations()
  const addresses = await getUserAddresses()
  const verifiedPhones = await getVerifiedPhones()

  return (
    <div>
      <div className='flex flex-wrap items-center gap-2 py-4 text-sm'>
        <Link href='/account' className='text-primary hover:underline'>
          {t('YourAccount')}
        </Link>
        <span>/</span>
        <span>{t('Addresses')}</span>
      </div>
      <h1 className='h1-bold pb-4'>{t('Addresses')}</h1>
      <p className='pb-4 text-sm text-muted-foreground'>
        {t('Saved addresses are pre-filled at checkout')}
      </p>
      <AddressBook
        initialAddresses={addresses}
        verifiedPhones={verifiedPhones}
      />
    </div>
  )
}
