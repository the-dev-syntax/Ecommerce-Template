import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import { ProfileForm } from './profile-form'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { getSetting } from '@/lib/actions/setting.actions'
import { getTranslations } from 'next-intl/server'



export async function generateMetadata() {
  const t = await getTranslations('ProfileManager');
  return {
    title: t('ChangeName'),
  };
}

export default async function ChangeNamePage() {
  const session = await auth()   // then passed here as a prop <SessionProvider session={session}>
  const { site } = await getSetting()
 const t = await getTranslations('ProfileManager')

  return (
    <div className='mb-24'>
      <SessionProvider session={session}>
        <div className='flex gap-2 '>
          <Link href='/account'>{t('YourAccount')}</Link>
          <span>›</span>
          <Link href='/account/manage'>{t('LoginSecurity')}</Link>
          <span>›</span>
          <span>{t('ChangeName')}</span>
        </div>
        <h1 className='h1-bold py-4'>{t('ChangeName')}</h1>
        <Card className='max-w-2xl'>
          <CardContent className='p-4 flex justify-between flex-wrap'>
            <p className='text-sm py-2'>
             {t.rich('Instructions', {
                  siteName: site.name,               
                  strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <ProfileForm />
          </CardContent>
        </Card>
      </SessionProvider>
    </div>
  )
}
 // The `strong` key here corresponds to the <strong> tag in your JSON