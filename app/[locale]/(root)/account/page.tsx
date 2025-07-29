import BrowsingHistoryList from '@/components/shared/browsing-history-list'
import { Card, CardContent } from '@/components/ui/card'
import { Home, PackageCheckIcon, User } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import React from 'react'


export async function generateMetadata() {
  const t = await getTranslations('ProfileManager');
  return {
    title: t('YourAccount'),
  };
}

export default async function AccountPage() {

  const t = await getTranslations('ProfileManager')
  return (
    <div>
      <h1 className='h1-bold py-4'>{t('YourAccount')}</h1>
      <div className='grid md:grid-cols-3 gap-4 items-stretch'>
        <Card>
          <Link href='/account/orders'>
            <CardContent className='flex items-start gap-4 p-6'>
              <div>
                <PackageCheckIcon className='w-12 h-12' />
              </div>
              <div>
                <h2 className='text-xl font-bold'>{t('Orders')}</h2>
                <p className='text-muted-foreground'>
                  {t('Track')}, {t('return')}, {t('cancelAnOrder')}, {t('downloadInvoice')} {t('or')} {t('buyAgain')}
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card>
          <Link href='/account/manage'>
            <CardContent className='flex items-start gap-4 p-6'>
              <div>
                <User className='w-12 h-12' />
              </div>
              <div>
                <h2 className='text-xl font-bold'>{t('LoginSecurity')}</h2>
                <p className='text-muted-foreground'>
                  {t('ManagePassword')}, {t('email')} {t('and')} {t('mobileNumber')}
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card>
          <Link href='/account/addresses'>
            <CardContent className='flex items-start gap-4 p-6'>
              <div>
                <Home className='w-12 h-12' />
              </div>
              <div>
                <h2 className='text-xl font-bold'>{t('Addresses')}</h2>
                <p className='text-muted-foreground'>
                  Edit, remove or set default address
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
      <BrowsingHistoryList className='mt-16' />
    </div>
  )
}