import { Cairo, Geist, Geist_Mono } from 'next/font/google'
import '../globals.css'
import ClientProviders from '@/components/shared/client-providers'
import { getDirection } from '@/i18n-config'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { getSetting } from '@/lib/actions/setting.actions'
import { cookies } from 'next/headers'
import { Metadata } from 'next/types'
import CookieConsentBanner from '@/components/shared/cookie-consent-banner'
import { fontStack, hexForeground, hexToHsl } from '@/lib/colors'
import { getSiteUrl } from '@/lib/env'
import { absoluteSiteUrl, resolveOgImage } from '@/lib/seo-url'
import { resolveCurrency } from '@/lib/currency'
import { auth } from '@/auth'

// Force dynamic rendering - required because layout uses database calls and cookies
export const dynamic = 'force-dynamic'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const cairo = Cairo({
  variable: '--font-cairo',
  subsets: ['arabic', 'latin'],
})

export async function generateMetadata(props: {
  params:  Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  const setting = await getSetting()
  const {
    site: { slogan, name, description, url },
    seo,
  } = setting

  const defaultTitle = seo.titleTemplate || `%s | ${name}`
  const seoDescription = seo.defaultDescription || description
  const siteUrl = getSiteUrl(url)
  const ogImage = resolveOgImage(seo.ogImage)
  const icon = setting.brand.favicon || '/favicon.ico'

  return {
    title: {
      template: defaultTitle,
      default: `${name}. ${slogan}`,
    },
    description: seoDescription,
    metadataBase: new URL(siteUrl),
    icons: { icon },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    // --- Open Graph (for Facebook, Pinterest, etc.) ---
    // Each public route sets its own canonical and page-level Open Graph data;
    // this layout only supplies defaults for routes that do not.
    openGraph: {
      title: {
        template: defaultTitle,
        default: `${name} | ${slogan}`,
      },
      description: seoDescription,
      siteName: name,
      images: [
        {
          url: absoluteSiteUrl(siteUrl, ogImage),
          width: 1200,
          height: 630,
          alt: `Default Open Graph image for ${name}`,
        },
      ],
      locale: locale, // Important for i18n
      type: 'website',
    },
    // --- Twitter Card ---
    twitter: {
      card: 'summary_large_image',
      site: seo.twitterHandle || undefined,
      title: {
        template: defaultTitle,
        default: `${name} | ${slogan}`,
      },
      description: seoDescription,
      images: [absoluteSiteUrl(siteUrl, ogImage)],
    },
    // Optional: other useful tags
    // themeColor: '#ffffff',
    // manifest: '/manifest.json',
  }
}

export default async function AppLayout({
  params,
  children,
}: {
  // params: { locale: string }
  params: Promise<{ locale: string }>
  children: React.ReactNode
}) {
  const setting = await getSetting()
  const currencyCookie = (await cookies()).get('currency')?.value
  const currency = resolveCurrency(
    setting.availableCurrencies,
    currencyCookie,
    setting.defaultCurrency
  )

  // The owner id drives the cart-owner sync so a cart persisted on a shared
  // browser cannot outlive its signed-in owner.
  const session = await auth()
  const ownerId = session?.user?.id

  const { locale } = await params
  // Ensure that the incoming `locale` is valid
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!routing.locales.includes(locale as any)) {
    notFound()
  }
  const messages = await getMessages()
  const primaryHsl = hexToHsl(setting.brand.primaryColor) ?? '47.9 95.8% 53.1%'
  const accentHsl = hexToHsl(setting.brand.accentColor) ?? '199 89% 48%'

  return (
    <html
      lang={locale}
      dir={getDirection(locale) === 'rtl' ? 'rtl' : 'ltr'}
      suppressHydrationWarning
      style={
        {
          '--primary': primaryHsl,
          '--primary-foreground': hexForeground(setting.brand.primaryColor),
          '--brand': primaryHsl,
          '--brand-foreground': hexForeground(setting.brand.primaryColor),
          '--brand-accent': accentHsl,
        } as React.CSSProperties
      }
    >
      <body
        className={`min-h-screen ${geistSans.variable} ${geistMono.variable} ${cairo.variable} antialiased`}
        style={{ fontFamily: fontStack(setting.brand.fontFamily) }}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ClientProviders
            setting={{ ...setting, currency }}
            ownerId={ownerId}
          >
            {children}
            <CookieConsentBanner />
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
