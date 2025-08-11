import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Card, CardContent } from '@/components/ui/card'
import { EmailForm } from './email-form'

export async function generateMetadata() {
  const t = await getTranslations('ProfileManager');
  return {
    title: t('ChangeEmail'),
  };
}

export default async function ChangeEmailPage() {
  const session = await auth()
  const t = await getTranslations('ProfileManager')

  return (
    <div className='mb-24'>
      <SessionProvider session={session}>
        <div className='flex gap-2 '>
          <Link href='/account'>{t('YourAccount')}</Link>
          <span>›</span>
          <Link href='/account/manage'>{t('LoginSecurity')}</Link>
          <span>›</span>
          <span>{t('ChangeEmail')}</span>
        </div>
        <h1 className='h1-bold py-4'>{t('ChangeEmail')}</h1>
        <Card className='max-w-2xl'>
          <CardContent className='p-4 flex flex-col gap-4'>
            <p className='text-sm py-2'>
              {t('CurrentEmail')} <strong>{session?.user.email}</strong>.
            </p>
            <p className='text-sm py-2'>
              {t('EmailChangeWarning')}
            </p>
            <EmailForm />
          </CardContent>
        </Card>
      </SessionProvider>
    </div>
  )
}