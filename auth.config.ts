import type { NextAuthConfig, User } from 'next-auth'
import { UserRole } from './types'
// import { redis } from "./lib/redis";
// import { KV_USER_PREFIX } from './lib/constants'

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
    session({ session, user }) {
      session.user.id = user.id as string;
      session.user.image = user.image as string;
      session.user.role = user.role as UserRole;
      session.user.name = user.name ?? user.email!.split("@")[0];
      session.user.email = user.email as string;
      session.user.emailVerified = user.emailVerified as Date | null;
      return session;
    },
  },
} satisfies NextAuthConfig