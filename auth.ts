import NextAuth from 'next-auth' // The main NextAuth library and a standard session type from Node_module
import CredentialsProvider from 'next-auth/providers/credentials' // Tool for email/password login from Node_module/nextAuth file
// import { MongoDBAdapter } from '@auth/mongodb-adapter' // Tool to connect NextAuth to your DB from Node_module/@auth file
import authConfig from './auth.config'    // Partial auth config (used by middleware)
import { connectToDatabase } from './lib/db' //  mongoose connecting to DB
// import client from './lib/db/client'  // You create an *instance* of `MongoClient` to establish a connection.
import User from './lib/db/models/user.model' 
// import bcrypt from 'bcryptjs'
import Google from 'next-auth/providers/google'
import { redis } from './lib/redis'
import { UserSignInSchema } from './lib/validator'
import { KV_USER_PREFIX } from './lib/constants'
import { UpstashRedisAdapter } from "@auth/upstash-redis-adapter"
import { AuthenticatedUser } from './types/next-auth';
import { cachedGetUserByKey, getCachedUserByKey } from './lib/actions/auth.actions';
// import { UserRole } from './types'

 

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
        // 1. after sign in
        console.log('inside autherize credentials ??????????????????????????????????', credentials) //! returns password in the callbackurl 
        // 1. Validate the input with the correct schema
        const validatedFields = UserSignInSchema.safeParse(credentials);
        // console.log('validatedFields', validatedFields)
        // 2. If validation fails, return null immediately
        if (!validatedFields.success) {
          console.error("Zod Validation Failed:", validatedFields.error.flatten().fieldErrors);
          return null;
        }
  
        await connectToDatabase()
        // console.log('from auth credentials:', validatedFields.data)

        if (validatedFields.data == null) return null
          
        const { email, password } = validatedFields.data;
      
          const user = await User.authenticate(email, password);

          if (!user) return null

          console.log('IN AUTHERIZE user', user)


        return user       
      },
    }),
  ],  
  callbacks: { 
     async jwt({ token, user, account, profile, trigger, session }) {
      //2. after sign in - it is encrypted will not be accessed 
      // Runs on first sign-in; `user` is the value returned by authorize() also account will have value only the first time
      // token is {name, email, picture, sub}      
      console.log('in auth jwt callback user 1111111111111111111111111111111***', user)  
      console.log('in auth jwt callback token 222222222222222222222222222222', token)
      console.log('in auth jwt callback account ++++++++++++++++++++++++++', account) // only the first 
      console.log('in auth jwt callback profile $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$', profile)
      console.log('in auth jwt callback session !!!!!!!!!!!!!!!!!!!!!!!!!!!!!', session)
      console.log('in auth jwt callback trigger @@@@@@@@@@@@@@@@@@@@@@@@@@@@@', trigger)

     if (user?.id && account) {

      const key = `${KV_USER_PREFIX}:${user.id}`;
      token = { ...token, kvKey: key }

      try {

        await redis.set(key, JSON.stringify(user), { ex: 60 * 60 * 24 } );

      } catch (err) {
        console.error("Failed to write user snapshot to Redis:", err);
        // Don't throw; allow sign-in to continue.
      }
    }

      console.log('in auth jwt callback user 333333333333333333333333333333333', user)  
      console.log('in auth jwt callback token 4444444444444444444444444444444', token)  
      return token;
    },
      async session({ session, token, user }) {
      console.log('in SESSION callback auth user: 555555555555555555555555', user)
      console.log('in SESSION callback auth token: 6666666666666666666666666666', token)
      console.log('SESSION callback in auth: 777777777777777777777777777777', session)
      if (token.kvKey) {
        console.log("SESSION callback in auth start redis GET -----------------------------------------------")
          try {
           const upstashUser : AuthenticatedUser | null  = await redis.get(token.kvKey);

           session.user = { ...session.user, ...upstashUser }

          }catch (error) {
            console.error("Failed to retrieve user session from Redis:", error);
          }   
       }  

      console.log('SESSION callback in auth token: 888888888888888888888888888', token)
      console.log('SESSION callback in auth: 9999999999999999999999999999', session)

      return session
    },      
  },
    events: {
    async signOut(message) {   
      if ("token" in message && message.token) {     
      const token = message.token;  

      if (token.kvKey) {
        try {
          console.log(`Signing out user. Deleting Redis key: ${token.kvKey}`);
          await redis.del(token.kvKey);
        } catch (error) {
          console.error("Failed to delete user session from Redis on signout:", error);
        }
      }
    }
    }
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