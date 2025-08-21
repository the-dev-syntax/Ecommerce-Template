'use client'
import { redirect, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { IUserSignIn } from '@/types'
import { signInWithCredentials } from '@/lib/actions/user.actions'

import { toast } from '@/hooks/use-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserSignInSchema } from '@/lib/validator'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import useSettingStore from '@/hooks/use-setting-store'
import { Suspense } from 'react'

const signInDefaultValues =
  process.env.NODE_ENV === 'development'
    ? {
        email: 'admin@example.com',
        password: '123456',
      }
    : {
        email: '',  
        password: '',
      }

function VerificationMessage( {isVerified} : {isVerified: boolean} ) {

  if (isVerified) {
    return (
      <div className="mb-4 p-3 bg-green-100 text-green-800 border border-green-200 rounded-md">
        ✅ Your email has been verified successfully! Please log in to continue.
      </div>
    );
  }

  return null; // Don't render anything if the param isn't there
}


export default function CredentialsSignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const isVerified = searchParams.get('verified') === 'true';


  const { setting: { site } } = useSettingStore()

  const form = useForm<IUserSignIn>({
    resolver: zodResolver(UserSignInSchema),   // zod validation
    defaultValues: signInDefaultValues,
  })

  const { control, handleSubmit } = form

  const onSubmit = async (data: IUserSignIn) => {
    try {
      await signInWithCredentials({   // auth authentication with DB , +token +session
        email: data.email,
        password: data.password,
      })
      redirect(callbackUrl)
    } catch (error) {
      if (isRedirectError(error)) {
        throw error
      }
      toast({
        title: 'Error',
        description: 'Invalid email or password',
        variant: 'destructive',
      })
    }
  }



  return (
    <div>
      <Suspense fallback={null}>
        <VerificationMessage isVerified={isVerified} />
      </Suspense>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type='hidden' name='callbackUrl' value={callbackUrl} />
          <div className='space-y-6'>
            <FormField
              control={control}
              name='email'
              render={({ field }) => (
                <FormItem className='w-full'>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder='Enter email address' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name='password'
              render={({ field }) => (
                <FormItem className='w-full'>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      placeholder='Enter password'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Button type='submit'>Sign In</Button>
            </div>
            <div className='text-sm'>
              By signing in, you agree to {site.name}&apos;s{' '}
              <Link href='/page/conditions-of-use'>Conditions of Use</Link> and{' '}
              <Link href='/page/privacy-policy'>Privacy Notice.</Link>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}

/*
? {...field} spreads these values
<Input
  value={field.value}
  onChange={field.onChange}
  onBlur={field.onBlur}
  name={field.name}
  ref={field.ref}
   ... other Input props ...
/>
*/