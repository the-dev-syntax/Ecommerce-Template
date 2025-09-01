import { UserRole } from "./index"

// This augments the JWT type
declare module 'next-auth/jwt' {
  interface JWT{   
    kvKey?: string;    
  }
}

// This augments the Session and the initial User object for client-side.
declare module 'next-auth' {
  interface Session {
    user: {
        id: string
        name: string
        email:string
        role: UserRole
        emailVerified: Date | null     
     }
  }
  // This tells NextAuth what your User object from the DB looks like
  interface User {   
    role: UserRole;
    emailVerified: Date | null;  // for middleware not auth.ts
  }
}
