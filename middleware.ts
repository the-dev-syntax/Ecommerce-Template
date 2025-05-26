import NextAuth from 'next-auth'
import authConfig from './auth.config'

export const { auth: middleware } = NextAuth(authConfig)  //? { auth: middleware } renaming auth => middleware, not defining its type.

export const config = {
  matcher: [
    /*
     * Match all request paths (to restrict) except for the ones starting with (pass freely):
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}