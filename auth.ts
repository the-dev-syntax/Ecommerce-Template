import NextAuth from 'next-auth' // The main NextAuth library and a standard session type from Node_module
import CredentialsProvider from 'next-auth/providers/credentials' // Tool for email/password login from Node_module/nextAuth file
import { MongoDBAdapter } from '@auth/mongodb-adapter' // Tool to connect NextAuth to your DB from Node_module/@auth file
import authConfig from './auth.config'    // Partial auth config (used by middleware)
import { connectToDatabase } from './lib/db' //  mongoose connecting to DB
import { clientPromise } from './lib/db/client'  // Cached MongoClient promise for connection reuse
import User from './lib/db/models/user.model' 
// import bcrypt from 'bcryptjs'
import Google from 'next-auth/providers/google'
import { UserSignInSchema } from './lib/validator'
import { UserRole } from './types'
import { limitSignInAttempts } from './lib/rate-limit'
import { normalizeEmail } from './lib/utils'
// import { AuthenticatedUser } from './types/next-auth'


 

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  pages: {
    signIn: '/sign-in',
    newUser: '/sign-up',
    error: '/sign-in',
  },
  session: {
    strategy: 'jwt',
  },
  adapter: MongoDBAdapter(clientPromise),
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
       
        // console.log('inside autherize credentials ??????????????????????????????????', credentials) //! returns password in the callbackurl 
        
        const validatedFields = UserSignInSchema.safeParse(credentials);
        // console.log('validatedFields', validatedFields)
        
        if (!validatedFields.success) {
          console.error("Zod Validation Failed:", validatedFields.error.flatten().fieldErrors);
          return null;
        }
  
        await connectToDatabase()
        // console.log('from auth credentials:', validatedFields.data)

        if (validatedFields.data == null) return null
          
        const { email, password } = validatedFields.data;
        const normalizedEmail = normalizeEmail(email)

        try {
          await limitSignInAttempts(normalizedEmail)
        } catch {
          return null
        }

          const user = await User.authenticate(normalizedEmail, password);

          if (!user) return null

          // console.log('IN AUTHERIZE user', user)


        return user       
      },
    }),
  ],  
  callbacks: { 
     async jwt({ token, user }) {
      if (user?.id) {
        token = {
          ...token,
          ...user,
          sub: user.id,
          // Keep the original sign-in time; Auth.js re-issues the JWT on
          // every session read, so token.iat is not stable.
          authTime: Math.floor(Date.now() / 1000),
        }
      }

      const userId = token.sub as string | undefined
      if (!userId) return token

      try {
        await connectToDatabase()
        const freshUser = await User.findById(userId)
          .select('name email role emailVerified passwordChangedAt')
          .lean()

        // The account was deleted: returning null clears the session cookie.
        if (!freshUser) return null

        // A password change/reset invalidates tokens issued before it.
        if (
          freshUser.passwordChangedAt &&
          token.authTime &&
          token.authTime * 1000 <
            new Date(freshUser.passwordChangedAt).getTime()
        ) {
          return null
        }

        token.role = freshUser.role as UserRole
        token.emailVerified = (freshUser.emailVerified ?? null) as Date | null
        token.name = freshUser.name ?? token.name
        token.email = freshUser.email ?? token.email
      } catch {
        // If the lookup fails, fail closed for privileged access.
        token.role = 'user'
        token.emailVerified = null
      }

      return token
    },
      async session({ session, token }) {
        return {
          ...session,
          user: {
            id: token.sub as string,
            role: (token.role as UserRole) ?? 'user',
            emailVerified: token.emailVerified as Date | null,
            image: token.picture ?? '',
            name: token.name ?? '',
            email: token.email ?? '',
          },
        }
      },      
  },
})


/*
LOGS from auth ::::::::::::::::::::::::::::::::::::::::::
callbacks: jwt :
in auth jwt callback account ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ only with first sign-in have value
 {
  providerAccountId: '68b48faa0c6f97b0644040a0',
  type: 'credentials',
  provider: 'credentials'
}

IN AUTHERIZE user {
  id: '68b48faa0c6f97b0644040a0',
  name: 'Anna',
  email: 'anna@example.com',
  role: 'user',
  emailVerified: null
}
in auth jwt callback user 1111111111111111111111111111111*** {
  id: '68b48faa0c6f97b0644040a0',
  name: 'Anna',
  email: 'anna@example.com',
  role: 'user',
  emailVerified: null
}
in auth jwt callback token 222222222222222222222222222222 {
  name: 'Anna',
  email: 'anna@example.com',
  picture: undefined,
  sub: '68b48faa0c6f97b0644040a0'
}
in auth jwt callback account ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ {
  providerAccountId: '68b48faa0c6f97b0644040a0',
  type: 'credentials',
  provider: 'credentials'
}
in auth jwt callback profile $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ undefined
in auth jwt callback user 333333333333333333333333333333333 {
  id: '68b48faa0c6f97b0644040a0',
  name: 'Anna',
  email: 'anna@example.com',
  role: 'user',
  emailVerified: null
}
in auth jwt callback token 4444444444444444444444444444444 {
  name: 'Anna',
  email: 'anna@example.com',
  picture: undefined,
  sub: '68b48faa0c6f97b0644040a0',
  kvKey: 'Custom-auth:user:68b48faa0c6f97b0644040a0'
}


 session.user = {
        id: token.id as string,
        name: token.name ?? token.email?.split("@")[0] ?? "",
        email: token.email as string,
        role: token.role as UserRole,
        emailVerified: token.emailVerified as Date | null,
        image: token.picture as string | undefined,
      }// session is a mirror of the token due to above ==> session: { strategy: 'jwt',

  // events: {
  //   async signOut(message) {
  //     // The token contains the kvKey you set in the jwt callback (for JWT sessions)
  //     const token = (message as { token?: any }).token;
  //     if (token?.kvKey) {
  //       try {
  //         console.log(`Signing out user. Deleting Redis key: ${token.kvKey}`);
  //         await redis.del(token.kvKey);
  //       } catch (error) {
  //         console.error("Failed to delete user session from Redis on signout:", error);
  //       }
  //     }
  //   },
  // },

          session: async ({ session, user, token }) => { // 'token' here is the decoded JWT from the 'jwt' callback
      // 'user' here is the original user object from provider (less common to use here if JWT strategy)
      // Add data from the JWT token to the client-side session object
      session.user.id = token.sub as string   // 'sub' in JWT is usually the user ID
      session.user.role = token.role as UserRole // Add the role from the token
      session.user.name = token.name as string // Add the name from the token

      // If session was updated, ensure the client-side session reflects it (though 'token' usually has the latest)
      if (trigger === 'update' && session.user && user) { // 'user' here might be from session update payload
         session.user.name = user.name
      }
      return session // Return the modified session object
    },
*/
/*
 const user = await User.findOne({ email: email }).select('+password')       

        if (user && user.password) {
          const isMatch = await bcrypt.compare(
            password as string,
            user.password
          )
          if (isMatch) { // authenticated by DB ==> get me this user info
            // console.log('Auth in autherize: USER MATCHED:', user)
            return {
              id: user._id.toString(),
              name: user.name|| user.email!.split('@')[0],
              email: user.email,
              role: user.role,
              emailVerified: user.emailVerified
            }
*/
