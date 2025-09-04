import type { NextAuthConfig } from 'next-auth'
// import { redis } from "./lib/redis";
// import { KV_USER_PREFIX } from './lib/constants'
import { AuthenticatedUser } from './types/next-auth';
import { redis } from './lib/redis';
// import { cachedGetUserByKey, getCachedUserByKey } from './lib/actions/auth.actions';

// import { UserRole } from './types';


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
    // async jwt({ token , user}) {
    //   console.log('CONFIG: first : from async jwt config token: aaaaaaaaaaaaaaaaaaaaaaaaaaaa', token);           
    //   console.log('CONFIG: first : from async jwt config user: bbbbbbbbbbbbbbbbbbbbbbbbbbbb', user); // undefined     
      
    //   console.log("CONFIG: after redis: from async jwt : token cccccccccccccccccccccccccc", token)
    //   return token
    // },
   async session({ session, token }) { // user
    
      console.log('CONFIG: 1.from async session config: session =>', session);
      console.log('CONFIG: 2.from async session config: token =>', token);
      // console.log('CONFIG: 2.from async session config: user UUUUUUUUUUUUUUUUUUUUUUUUUUUU=>', user);
      const key = token.kvKey as string;
      try {
          const upstashUser : AuthenticatedUser | null = await redis.get(key);
          console.log('CONFIG: 3.from async session config: upstashUser =>', upstashUser);
          session = { 
             ...session,
             user: {
               ...session.user,
               ...upstashUser
             }
           };
      } catch (err) {
        console.error("Failed to fetch user upstashUser from Redis:", err);
      }        
       console.log('CONFIG: 3.from async session config: session  sssssssssssssssssssssssssss=>', session);
      return session;
    },
  },
} satisfies NextAuthConfig