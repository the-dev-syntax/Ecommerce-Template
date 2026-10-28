import NextAuth from 'next-auth'
import authConfig from './auth.config'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { splitLocaleFromPathname } from './lib/locale-path'


const publicPages = [
  '/',
  '/search',
  '/sign-in',
  '/sign-up',
  '/cart',
  '/cart/(.*)',
  '/product/(.*)',
  '/page/(.*)',
  '/verify-email',
  '/forgot-password',
  '/reset-password'
  // (/secret requires auth)
]

// Routes that require a session. Keep this list explicit: any other
// non-public path is an unknown route and is passed to next-intl so it renders
// a 404 instead of bouncing guests to the sign-in page.
const protectedPages = ['/account', '/admin', '/checkout', '/invoice']
// Subset that also requires a verified email address.
const verificationRequiredPages = ['/account', '/checkout', '/invoice']

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

const intlMiddleware = createMiddleware(routing)
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Anchor the locale to the first path segment. A plain startsWith('/fr')
  // wrongly matched routes such as /friends-page or /archives.
  const { locale, pathnameWithoutLocale } = splitLocaleFromPathname(
    pathname,
    routing.locales,
    routing.defaultLocale
  )

  const publicPathnameRegex = RegExp(
    `^(${publicPages
      .flatMap((p) => (p === '/' ? ['', '/'] : p))
      .join('|')})/?$`,
    'i'
  )
  const isPublicPage = publicPathnameRegex.test(pathnameWithoutLocale)

  if (isPublicPage) return intlMiddleware(req)

  const isProtectedPage = protectedPages.some((prefix) =>
    matchesPrefix(pathnameWithoutLocale, prefix)
  )

  // Unknown routes: let next-intl resolve the locale so the app renders its
  // 404 page (previously every typo redirected guests to sign-in).
  if (!isProtectedPage) return intlMiddleware(req)

  const session = req.auth

  // No auth → redirect and preserve the attempted page in the callback.
  if (!session || !session.user) {
    // With localePrefix: 'as-needed' the default locale must not be prefixed,
    // otherwise next-intl answers with an extra 308 hop.
    const signInPath =
      locale === routing.defaultLocale ? '/sign-in' : `/${locale}/sign-in`
    const newUrl = new URL(
      `${signInPath}?callbackUrl=${encodeURIComponent(pathname)}`,
      req.nextUrl.origin
    )
    return Response.redirect(newUrl)
  }

  if (
    matchesPrefix(pathnameWithoutLocale, '/admin') &&
    session.user.role !== 'admin'
  ) {
    const homeUrl = locale === routing.defaultLocale ? '/' : `/${locale}`
    return Response.redirect(new URL(homeUrl, req.nextUrl.origin))
  }

  const requiresVerification = verificationRequiredPages.some((prefix) =>
    matchesPrefix(pathnameWithoutLocale, prefix)
  )

  if (requiresVerification && !session.user.emailVerified) {
    const verifyPath =
      locale === routing.defaultLocale
        ? '/verify-email'
        : `/${locale}/verify-email`
    const newUrl = new URL(
      `${verifyPath}?callbackUrl=${encodeURIComponent(pathname)}`,
      req.nextUrl.origin
    )
    return Response.redirect(newUrl)
  }

  return intlMiddleware(req)
})

export const config = {
  matcher: [
    // Match all pathnames except:
    // - /api (API routes)
    // - /_next (Next.js internals)
    // - /_vercel (Vercel internals)
    // - /favicon.ico, /sitemap.xml, /robots.txt (static files)
    // - Files with extensions (images, fonts, etc.)
    '/((?!api|_next|_vercel|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
}
