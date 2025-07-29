import NextAuth from 'next-auth'
import authConfig from './auth.config'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const publicPages = [
  '/',
  '/search',
  '/sign-in',
  '/sign-up',
  '/cart',
  '/cart/(.*)',
  '/product/(.*)',
  '/page/(.*)',
  // (/secret requires auth)
]

const intlMiddleware = createMiddleware(routing)
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  // return all public paths
  const publicPathnameRegex = RegExp(
            `^(/(${routing.locales.join('|')}))?(${publicPages
              .flatMap((p) => (p === '/' ? ['', '/'] : p))
              .join('|')})/?$`,
            'i'
  )
  // true if public
  const isPublicPage = publicPathnameRegex.test(req.nextUrl.pathname)

  if (isPublicPage) {
    // return NextResponse.next()
    return intlMiddleware(req)
  } else {
    // no auth then redirect and conserve the tried access page in the callback.
    if (!req.auth) {
      const newUrl = new URL(
        `/sign-in?callbackUrl=${
          encodeURIComponent(req.nextUrl.pathname) || '/'
        }`,
        req.nextUrl.origin
      )
      return Response.redirect(newUrl)
    } else {
      // access to protected page + language
      return intlMiddleware(req)
    }
  }
})

export const config = {
 matcher: ['/((?!api|_next|.*\\..*).*)'],
}
