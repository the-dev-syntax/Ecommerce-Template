import { UserRole } from "./index"
import { DefaultJWT } from "next-auth/jwt";

// This augments the JWT type should add role and emailVerified to pass it to session
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: UserRole;
    emailVerified?: Date | null;
  }
}

// This augments the Session and the initial User object for client-side useSession() return.
declare module 'next-auth' {
  interface Session {
    user: {
        id: string
        name: string
        email:string
        role: UserRole
        emailVerified: Date | null
        image: string  
     }
  }
  // This tells NextAuth what your User object from the DB looks like
  // interface User {   
  //   role: UserRole;
  //   emailVerified: Date | null;  // for middleware not auth.ts
  // }
}

// this is mongodb return to be saved in Upstash, then Upstash return it to auth.config then spread inside config session to be read in middleware.
export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: Date | null;
};

