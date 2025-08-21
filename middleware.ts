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
  '/verify-email'
  // (/secret requires auth)
]

const intlMiddleware = createMiddleware(routing)
const { auth } = NextAuth(authConfig)  

export default auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl
  // Determine the locale from the route
  const locale = routing.locales.find(loc => pathname.startsWith(`/${loc}`)) || routing.defaultLocale || 'en-US';

  // return all public paths
  const publicPathnameRegex = RegExp(
            `^(/(${routing.locales.join('|')}))?(${publicPages
              .flatMap((p) => (p === '/' ? ['', '/'] : p))
              .join('|')})/?$`,
            'i'
  )
  // true if public
  const isPublicPage = publicPathnameRegex.test(pathname)

  if (isPublicPage) {
    // return NextResponse.next()
    return intlMiddleware(req)
  } else {
   
    // no auth then redirect and conserve the tried access page in the callback.
    if (!session || !session.user) {
      const newUrl = new URL(
        `${locale}/sign-in?callbackUrl=${
          encodeURIComponent(pathname) || '/'
        }`,
        req.nextUrl.origin
      )
      return Response.redirect(newUrl)
    } else {
      // from here ==> access to protected page + language
      console.log('middleware:', session.user)
      console.log('middleware: id',session.user.id)
      console.log('middleware: role',session.user.role)
       const isEmailVerified = !!session.user.emailVerified;
      console.log('middleware:User email verification status:', isEmailVerified);
       const verificationRequiredRoutes = ['/checkout', '/account'];

       const requiresVerification = verificationRequiredRoutes.some(path =>
    pathname.includes(path)
  );
         
        if (requiresVerification && !isEmailVerified) {
           console.log ("middleware:redirect to verify-email page with callback URL")
          const newUrl = new URL(
            `${locale}/verify-email?callbackUrl=${encodeURIComponent(pathname)}` || '/',
            req.nextUrl.origin
          )
          return Response.redirect(newUrl)
        }
        console.log('middleware:User is authenticated - proceeding to the requested page:', pathname);
      return intlMiddleware(req)
    }
  }
})

export const config = {
 matcher: ['/((?!api|_next|.*\\..*).*)'],
}
