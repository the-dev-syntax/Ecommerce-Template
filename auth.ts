
import NextAuth from 'next-auth' // The main NextAuth library and a standard session type from Node_module
import CredentialsProvider from 'next-auth/providers/credentials' // Tool for email/password login from Node_module/nextAuth file
// import { MongoDBAdapter } from '@auth/mongodb-adapter' // Tool to connect NextAuth to your DB from Node_module/@auth file
import authConfig from './auth.config'    // Partial auth config (used by middleware)
import { connectToDatabase } from './lib/db' //  mongoose connecting to DB
// import client from './lib/db/client'  // You create an *instance* of `MongoClient` to establish a connection.
import User from './lib/db/models/user.model' // Your blueprint for what a "User" looks like in the DB
// import bcrypt from 'bcryptjs'
import Google from 'next-auth/providers/google'
import { redis } from './lib/redis'
import { UserSignInSchema } from './lib/validator'
// import { KV_USER_PREFIX } from './lib/constants'
import { UpstashRedisAdapter } from "@auth/upstash-redis-adapter"

 

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  pages: {
    signIn: '/sign-in',
    newUser: '/sign-up',
    error: '/sign-in',
  },
  session: {
    strategy: 'database',
    maxAge : 6 * 60 * 60, // 6 hour, suppose  24 * 60 * 60, = 1 day + add refresh token every day for 7 days.
  },
  adapter: UpstashRedisAdapter(redis),
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      // id: "domain-login",
      // name: "Domain Account",
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {  
        // console.log('inside autherize credentials', credentials)
        // 1. Validate the input with the correct schema
        const validatedFields = UserSignInSchema.safeParse(credentials);
        // console.log('validatedFields', validatedFields)
        // 2. If validation fails, return null immediately
        if (!validatedFields.success) {
          console.error("Zod Validation Failed:", validatedFields.error.flatten().fieldErrors);
          return null;
        }
        console.log('in autherize auth.ts zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')
        await connectToDatabase()
        // console.log('from auth credentials:', validatedFields.data)

        if (validatedFields.data == null) return null
          
        const { email, password } = validatedFields.data;
        
        const user = await User.authenticate(email, password);
        console.log('in autherize auth.ts && here is : user', user)

        if (user) return user

        return null
      },
    }),
  ],
  callbacks: { 
     async session({ session, user }) {
        console.log('in session callback', session, user)
        return {
        ...session, // Keep default session properties like expires.
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified ?? null, // Ensure emailVerified is present
          // We can add other safe properties here.
        }
      };
    },
  }
  
})
