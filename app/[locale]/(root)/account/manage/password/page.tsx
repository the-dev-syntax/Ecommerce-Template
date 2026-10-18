import { auth } from '@/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { Card, CardContent } from '@/components/ui/card'
import { PasswordForm } from './password-form'

export async function generateMetadata() {
  const t = await getTranslations()
  return {
    title: t('Change Password'),
  }
}

export default async function ChangePasswordPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/sign-in')

  const t = await getTranslations()

  return (
    <div className='mb-24'>
      <div className='flex gap-2 '>
        <Link href='/account'>{t('YourAccount')}</Link>
        <span>›</span>
        <Link href='/account/manage'>{t('LoginSecurity')}</Link>
        <span>›</span>
        <span>{t('Change Password')}</span>
      </div>
      <h1 className='h1-bold py-4'>{t('Change Password')}</h1>
      <Card className='max-w-2xl'>
        <CardContent className='p-4 flex flex-col gap-4'>
          <p className='text-sm py-2'>{t('PasswordChangeWarning')}</p>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
