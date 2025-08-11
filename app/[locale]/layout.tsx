import { Geist, Geist_Mono } from 'next/font/google'
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

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata(props: {
  params:  Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  const {
    site: { slogan, name, description, url },
  } = await getSetting()

  return {
    title: {
      template: `%s - ${name}`,
      default: `${name}. ${slogan}`,
    },
    description: description,
    // metadataBase: new URL(url),
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || url ||'http://localhost:3000'),
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
        template: `%s - ${name}`,
        default: `${name} | ${slogan}`,
      },
      description: description,
      url: '/',
      siteName: name,
      images: [
        {
          url: '/og-preview.jpg', // Default preview image
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
      title: {
        template: `%s - ${name}`,
        default: `${name} | ${slogan}`,
      },
      description: description,
      images: [`${url}/og-preview.jpg`], // Must be an absolute URL
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
  const currencyCookie = (await cookies()).get('currency')
  const currency = currencyCookie ? currencyCookie.value : 'USD'

  const { locale } = await params
  // Ensure that the incoming `locale` is valid
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!routing.locales.includes(locale as any)) {
    notFound()
  }
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      dir={getDirection(locale) === 'rtl' ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <body
        className={`min-h-screen ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ClientProviders setting={{ ...setting, currency }}>
            {children}
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
