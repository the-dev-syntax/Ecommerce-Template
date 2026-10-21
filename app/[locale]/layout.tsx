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
  const ogImage = seo.ogImage || '/og-preview.jpg'
  const icon = setting.brand.favicon || '/favicon.ico'

  return {
    title: {
      template: defaultTitle,
      default: `${name}. ${slogan}`,
    },
    description: seoDescription,
    // metadataBase: new URL(url),
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || url ||'http://localhost:3000'),
    icons: { icon },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    // Helps search engines understand the different language versions of your pages
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'en-US': '/en-US',
        fr: '/fr',
        ar: '/ar',
      },
    },
    // --- Open Graph (for Facebook, Pinterest, etc.) ---
    openGraph: {
      title: {
        template: defaultTitle,
        default: `${name} | ${slogan}`,
      },
      description: seoDescription,
      url: '/',
      siteName: name,
      images: [
        {
          url: ogImage,
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
      images: [/^https?:\/\//.test(ogImage) ? ogImage : `${url}${ogImage}`],
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
  const currency =
    currencyCookie &&
    setting.availableCurrencies.some((c) => c.code === currencyCookie)
      ? currencyCookie
      : setting.defaultCurrency

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
          <ClientProviders setting={{ ...setting, currency }}>
            {children}
            <CookieConsentBanner />
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
