import type { NextAuthConfig } from 'next-auth'
import { UserRole } from './types';


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
    async jwt({ token , user}) {
        console.log('CONFIG: first : from async jwt config token: aaaaaaaaaaaaaaaaaaaaaaaaaaaa', token);           
        console.log('CONFIG: first : from async jwt config user: bbbbbbbbbbbbbbbbbbbbbbbbbbbb', user); // undefined 
        console.log("CONFIG: after redis: from async jwt : token cccccccccccccccccccccccccc", token)
        return token
    },
    async session({ session, token, trigger }) { // user  only strategy DB  
        console.log('CONFIG: 1.from async session config: session =>', session);
        console.log('CONFIG: 2.from async session config: token =>', token);
        console.log('CONFIG: 3.from async session config: trigger =>', trigger);
        
        session  = {
            ...session,         
            user : {            
              id: token.sub as string,
              role: token.role as UserRole,
              emailVerified: token.emailVerified as Date | null,
              image: token.picture ?? "",
              name: token.name ?? "",
              email: token.email ?? "",
            }
          }        
        // console.log('CONFIG: 3.from async session config: session  sssssssssssssssssssssssssss=>', session);
        return session;
    },
  },
} satisfies NextAuthConfig

/*
? CONFIG: 1.from async session config: session => { user: { name: 'John', email: 'admin@example.com', image: undefined }, expires: '2025-10-02T12:23:34.360Z' }
CONFIG: 2.from async session config: token => { name: 'John', email: 'admin@example.com', sub: '68b48faa0c6f97b064404092', 
kvKey: 'Custom-auth:user:68b48faa0c6f97b064404092', iat: 1756815813, exp: 1759407813, jti: '93b18394-9bad-4ca8-bf30-90744bd83f0c', 
id: '68b48faa0c6f97b064404092', role: 'admin', emailVerified: '2025-07-30T00:00:00.000Z' } 
? CONFIG: 3.from async session config: session sssssssssssssssssssssssssss=> 
?  { 
?    user: {
?      name: 'John', 
?      email: 'admin@example.com', 
?      image: undefined, 
?      id: '68b48faa0c6f97b064404092', 
?      role: 'admin', 
?      emailVerified: 
?      '2025-07-30T00:00:00.000Z' 
?    }, 
?      expires: '2025-10-02T12:23:34.360Z' 
?  }
*/