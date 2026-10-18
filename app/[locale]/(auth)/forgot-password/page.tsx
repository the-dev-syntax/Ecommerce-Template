import { getTranslations } from 'next-intl/server'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ForgotPasswordForm } from './forgot-password-form'

export async function generateMetadata() {
  const t = await getTranslations()
  return {
    title: t('Forgot Password'),
  }
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations()

  return (
    <div className='w-full'>
      <Card>
        <CardHeader>
          <CardTitle className='text-2xl'>{t('Forgot Password')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground pb-4'>
            {t('ForgotPasswordInstructions')}
          </p>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
