import NextAuth from 'next-auth' // The main NextAuth library and a standard session type from Node_module
import CredentialsProvider from 'next-auth/providers/credentials' // Tool for email/password login from Node_module/nextAuth file
import { MongoDBAdapter } from '@auth/mongodb-adapter' // Tool to connect NextAuth to your DB from Node_module/@auth file
import authConfig from './auth.config'    // Partial auth config (used by middleware)
import { connectToDatabase } from './lib/db' //  mongoose connecting to DB
import client from './lib/db/client'  // You create an *instance* of `MongoClient` to establish a connection.
import User from './lib/db/models/user.model' // Your blueprint for what a "User" looks like in the DB
import bcrypt from 'bcryptjs'
import Google from 'next-auth/providers/google'


export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  pages: {
    signIn: '/sign-in',
    newUser: '/sign-up',
    error: '/sign-in',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 1 hour, suppose 30 * 24 * 60 * 60, = 30 days
  },
  adapter: MongoDBAdapter(client),
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      credentials: {
        email: {
          type: 'email',
        },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        await connectToDatabase()
        // console.log('from auth', credentials)
        if (credentials == null) return null

        const user = await User.findOne({ email: credentials.email })

        // console.log('Auth in autherize: USER FOUND:', user)

        if (user && user.password) {
          const isMatch = await bcrypt.compare(
            credentials.password as string,
            user.password
          )
          if (isMatch) { // authenticated by DB ==> get me this user info
            // console.log('Auth in autherize: USER MATCHED:', user)
            return {
              id: user._id,
              name: user.name|| user.email!.split('@')[0],
              email: user.email,
              role: user.role,
              emailVerified: user.emailVerified
            }
          }
        }
        return null
      },
    }),
  ],
  callbacks: { // if authenticated make him a JWT its info from DB the previous step.
    jwt: async ({ token, user, trigger, session }) => {
      // This check only runs once at sign-in.
      if (user) {
        if (!user.name) {
          await connectToDatabase()
          await User.findByIdAndUpdate(user.id, {
            name: user.name || user.email!.split('@')[0],
            role: 'user',
          })
        }
        token.sub = user.id; // 'sub' is the standard field for user ID in JWT
        token.name = user.name || user.email!.split('@')[0]
        token.role = user.role || 'user'
        token.email = user.email 
        token.emailVerified = user.emailVerified 
      }
      //  this is not for login; it's for user update in account/manage session updates.
      if (trigger === "update" && session?.user) { 
        token.name = session.user.name ?? token.name
        token.role = session.user.role ?? token.role
        token.email = session.user.email ?? token.email
        token.emailVerified = session.user.emailVerified ?? token.emailVerified
      }
      // runs on every subsequent request where the session is checked - Update the token with the fresh data
      if (token.sub) { 
        await connectToDatabase();
        const dbUser = await User.findById(token.sub).lean();
        
        if (dbUser) {          
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.role = dbUser.role;
          token.emailVerified = dbUser.emailVerified // emailVerified must be a DATE obj in JWT.
         
        } else {
          // If user doesn't exist in DB, invalidate the session by returning null
          return null; // <--- JWT has to return null or a valid JWT
        }
      }
      // console.log('auth: JWT callback:', token)
      return token
    },
    session: async ({ session, token }) => {
      session.user.id = token.sub as string
      session.user.role = token.role || 'user'
      session.user.name = token.name || token.email!.split('@')[0]
      session.user.email = token.email as string
      session.user.emailVerified = token.emailVerified // session is a mirror of the token due to above ==> session: { strategy: 'jwt',
      // console.log('session in auth:', session)
      return session
    },
  },
})