import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResetPasswordForm } from './reset-password-form'

export async function generateMetadata() {
  const t = await getTranslations()
  return {
    title: t('Reset Password'),
  }
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const t = await getTranslations()

  if (!token) {
    return (
      <div className='w-full'>
        <Card>
          <CardHeader>
            <CardTitle className='text-2xl'>{t('Reset Password')}</CardTitle>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <p className='text-sm'>
              {t('This reset link is invalid or has expired.')}
            </p>
            <Link href='/forgot-password'>
              <Button className='w-full' variant='outline'>
                {t('Forgot Password')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='w-full'>
      <Card>
        <CardHeader>
          <CardTitle className='text-2xl'>{t('Reset Password')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground pb-4'>
            {t('ResetPasswordInstructions')}
          </p>
          <ResetPasswordForm token={token} />
        </CardContent>
      </Card>
    </div>
  )
}
