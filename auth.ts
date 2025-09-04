import NextAuth from 'next-auth' // The main NextAuth library and a standard session type from Node_module
import CredentialsProvider from 'next-auth/providers/credentials' // Tool for email/password login from Node_module/nextAuth file
import { MongoDBAdapter } from '@auth/mongodb-adapter' // Tool to connect NextAuth to your DB from Node_module/@auth file
import authConfig from './auth.config'    // Partial auth config (used by middleware)
import { connectToDatabase } from './lib/db' //  mongoose connecting to DB
import client from './lib/db/client'  // You create an *instance* of `MongoClient` to establish a connection.
import User from './lib/db/models/user.model' 
// import bcrypt from 'bcryptjs'
import Google from 'next-auth/providers/google'
import { UserSignInSchema } from './lib/validator'
import { UserRole } from './types'
import { AuthenticatedUser } from './types/next-auth'


 

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
  adapter: MongoDBAdapter(client),
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
       
        console.log('inside autherize credentials ??????????????????????????????????', credentials) //! returns password in the callbackurl 
        
        const validatedFields = UserSignInSchema.safeParse(credentials);
        console.log('validatedFields', validatedFields)
        
        if (!validatedFields.success) {
          console.error("Zod Validation Failed:", validatedFields.error.flatten().fieldErrors);
          return null;
        }
  
        await connectToDatabase()
        console.log('from auth credentials:', validatedFields.data)

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
      // Runs on first sign-in; `user` is the value returned by authorize() also account will have value , both only the first time from autherize
      // token is {name, email, picture, sub}      
      console.log('in auth jwt callback user 1111111111111111111111111111111***', user)  // user from autherize first pass only
      console.log('in auth jwt callback token 222222222222222222222222222222', token)  // always have its own craeted value
      console.log('in auth jwt callback account ++++++++++++++++++++++++++', account) // only the first have value
      console.log('in auth jwt callback profile $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$', profile) // only with OAUTH
      console.log('in auth jwt callback session !!!!!!!!!!!!!!!!!!!!!!!!!!!!!', session) // if useSession().update the will have a value
      console.log('in auth jwt callback trigger @@@@@@@@@@@@@@@@@@@@@@@@@@@@@', trigger) // "signIn" | "signUp" | "update" | undefined

      if (user?.id){
         token = { 
          ...token, 
          ...user,
          sub: user.id 
        }
      }  
    
      if (trigger === "update" && session?.user?.id) {
        const freshUser : AuthenticatedUser | null = await User.findById(session.user.id);
        console.log('jwt callback freshUser *********************************', freshUser)
        if (freshUser)  {
           token = { 
            ...token, 
            ...user,          
          }
        }
        console.log('jwt callback token >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>', token)
      }

      console.log('in auth jwt callback user 333333333333333333333333333333333', user)  
      console.log('in auth jwt callback token 4444444444444444444444444444444', token)  

      return token;
    },
      async session({ session, token, user }) {
      console.log('in SESSION callback auth user: 555555555555555555555555', user)
      console.log('in SESSION callback auth token: 6666666666666666666666666666', token)
      console.log('SESSION callback in auth: 777777777777777777777777777777', session)
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

      console.log('SESSION callback in auth token: 888888888888888888888888888', token)
      console.log('SESSION callback in auth: 9999999999999999999999999999', session)

      return session
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