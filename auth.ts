import NextAuth, { type DefaultSession } from 'next-auth' // The main NextAuth library and a standard session type from Node_module
import CredentialsProvider from 'next-auth/providers/credentials' // Tool for email/password login from Node_module/nextAuth file
import { MongoDBAdapter } from '@auth/mongodb-adapter' // Tool to connect NextAuth to your DB from Node_module/@auth file
import authConfig from './auth.config'    // Partial auth config (used by middleware)

import { connectToDatabase } from './lib/db' //  mongoose connecting to DB
import client from './lib/db/client'  // You create an *instance* of `MongoClient` to establish a connection.
import User from './lib/db/models/user.model' // Your blueprint for what a "User" looks like in the DB

import bcrypt from 'bcryptjs'
import Google from 'next-auth/providers/google'




declare module 'next-auth' {
  // eslint-disable-next-line no-unused-vars
  interface Session {
    user: { role: string } & DefaultSession['user'] }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  pages: {
    signIn: '/sign-in',
    newUser: '/sign-up',
    error: '/sign-in',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
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
        if (credentials == null) return null

        const user = await User.findOne({ email: credentials.email })

        if (user && user.password) {
          const isMatch = await bcrypt.compare(
            credentials.password as string,
            user.password
          )
          if (isMatch) {
            return {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
            }
          }
        }
        return null
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        if (!user.name) {
          await connectToDatabase()
          await User.findByIdAndUpdate(user.id, {
            name: user.name || user.email!.split('@')[0],
            role: 'user',
          })
        }
        token.name = user.name || user.email!.split('@')[0]
        token.role = (user as { role: string }).role
      }

      if (session?.user?.name && trigger === 'update') {
        token.name = session.user.name
      }
      return token
    },
    session: async ({ session, user, trigger, token }) => {
      session.user.id = token.sub as string
      session.user.role = token.role as string
      session.user.name = token.name
      if (trigger === 'update') {
        session.user.name = user.name
      }
      return session
    },
  },
})