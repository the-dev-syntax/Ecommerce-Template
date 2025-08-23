import { Suspense } from 'react';
import VerifyClientToken from './VerifyClientToken';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { i18n } from '@/i18n-config';


export async function generateStaticParams() {
  const locales = i18n.locales; 

  return locales.map((locale) => ({
    locale: locale.code,
  }));
}
// Use Suspense to handle the case where searchParams might not be immediately available
export default async function VerifyEmailPage(props: {
   params: Promise<{ locale: string }>   
}) {
  const params = await props.params
  const locale = params.locale

  const session = await auth();   

  // Perform all session checks and redirects here on the server
  if (!session || !session.user) {
    redirect(`/${locale}/sign-in`);
  }

  if (session.user.emailVerified) {
    redirect(`/${locale}/`);
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyClientToken />
      </Suspense>
    </div>
  );
}