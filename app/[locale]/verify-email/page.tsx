import { Suspense } from 'react';
import mongoose from 'mongoose';

import VerifyClientToken from './VerifyClientToken';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/db';
import User from '@/lib/db/models/user.model';
import { hasPendingEmailChange } from '@/lib/email-change';
import { localizedPath } from '@/lib/utils';

// Force dynamic rendering - this page uses auth session
export const dynamic = 'force-dynamic'
// Use Suspense to handle the case where searchParams might not be immediately available
export default async function VerifyEmailPage(props: {
   params: Promise<{ locale: string }>   
}) {
  const params = await props.params
  const locale = params.locale

  const session = await auth();   

  // Perform all session checks and redirects here on the server
  if (!session || !session.user) {
    redirect(localizedPath(locale, '/sign-in'));
  }

  if (session.user.emailVerified) {
    // A verified account still needs this page while an email change is
    // pending; otherwise the OTP form is unreachable and the change never
    // completes.
    let pending = false
    if (mongoose.isValidObjectId(session.user.id)) {
      await connectToDatabase()
      const user = await User.findById(session.user.id)
        .select('pendingEmail pendingEmailExpires')
        .lean()
      pending = hasPendingEmailChange(user)
    }
    if (!pending) {
      redirect(localizedPath(locale, '/'));
    }
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyClientToken />
      </Suspense>
    </div>
  );
}
