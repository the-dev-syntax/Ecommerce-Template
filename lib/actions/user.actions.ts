'use server'
import { signIn, signOut } from '@/auth'
import { IUserSignIn } from '@/types'
import { redirect } from 'next/navigation'




export async function signInWithCredentials(user: IUserSignIn) {
    
  return await signIn('credentials', { ...user, redirect: false })
}
export const SignOut = async () => {
  const redirectTo = await signOut({ redirect: false })
  redirect(redirectTo.redirect)
}

/*
? zod validated the data client side , now validated again with zod server side
?  before sending it to be authenticated by DB


*/