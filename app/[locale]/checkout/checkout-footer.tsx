
import Link from 'next/link'
import React from 'react'
import { getTranslations } from 'next-intl/server'
import { getSetting } from '@/lib/actions/setting.actions'

export default async function CheckoutFooter() {
  const settings = await getSetting()
  const siteName = settings.site.name
  const t = await getTranslations('CheckoutFooter')
  return (
    <div className='border-t-2 space-y-2 my-4 py-4 text-sm text-muted-foreground'>
      <p>
        {t.rich('needHelp', {
          helpLink: (chunks) => (
            <Link href='/page/help' className='link'>
              {chunks}
            </Link>
          ),
          contactLink: (chunks) => (
            <Link href='/page/contact-us' className='link'>
              {chunks}
            </Link>
          ),
        })}
      </p>
      <p>
        {t.rich('orderAgreement', {
          siteName: siteName,
          privacyLink: (chunks) => (
            <Link href='/page/privacy-policy' className='link'>
              {chunks}
            </Link>
          ),
          conditionsLink: (chunks) => (
            <Link href='/page/conditions-of-use' className='link'>
              {chunks}
            </Link>
          ),
        })}
      </p>
      <p>
        {t.rich('returnsPolicy', {
          siteName: siteName,
          policyLink: (chunks) => (
            <Link href='/page/returns-policy' className='link'>
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  )
}

/*
<div className='border-t-2 space-y-2 my-4 py-4'>
      <p>
        Need help? Check our <Link href='/page/help'>Help Center</Link> or{' '}
        <Link href='/page/contact-us'>Contact Us</Link>{' '}
      </p>
      <p>
        For an item ordered from {siteName}: When you click the &apos;Place Your
        Order&apos; button, we will send you an e-mail acknowledging receipt of
        your order. Your contract to purchase an item will not be complete until
        we send you an e-mail notifying you that the item has been shipped to
        you. By placing your order, you agree to {siteName}
        &apos;s <Link href='/page/privacy-policy'>privacy notice</Link> and
        <Link href='/page/conditions-of-use'> conditions of use</Link>.
      </p>
      <p>
        Within 30 days of delivery, you may return new, unopened merchandise in
        its original condition. Exceptions and restrictions apply.{' '}
        <Link href='/page/returns-policy'>
          See {siteName}&apos;s Returns Policy.
        </Link>
      </p>
    </div>
*/