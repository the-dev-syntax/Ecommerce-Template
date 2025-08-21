import type { NextAuthConfig } from 'next-auth'

// Notice this is only an object, not a full Auth.js instance, will provide them in auth.ts"the real implementation of auth"
export default {
  providers: [],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authorized({ request, auth }: any) {
      const protectedPaths = [
        /\/checkout(\/.*)?/,
        /\/account(\/.*)?/,
        /\/admin(\/.*)?/,
      ]
      const { pathname } = request.nextUrl
      if (protectedPaths.some((p) => p.test(pathname))) return !!auth
      return true
    },
    jwt({ token }) {
      return token
    },
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub
        session.user.role = token.role 
        session.user.emailVerified = token.emailVerified 
      }
      return session
    },
  },
} satisfies NextAuthConfig