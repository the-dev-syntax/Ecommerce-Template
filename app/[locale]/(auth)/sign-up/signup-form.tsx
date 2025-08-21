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
import { IUserSignUp } from '@/types'
import { registerUser, signInWithCredentials } from '@/lib/actions/user.actions'
import { toast } from '@/hooks/use-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserSignUpSchema } from '@/lib/validator'
import { Separator } from '@/components/ui/separator'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import useSettingStore from '@/hooks/use-setting-store'
import { useTranslations } from 'next-intl'


const signUpDefaultValues =
  process.env.NODE_ENV === 'development'
    ? {
        name: 'john doe',
        email: 'john@me.com',
        password: '123456',
        confirmPassword: '123456',
      }
    : {
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      }

export default function SignUpForm() {
  const { setting: { site } } = useSettingStore()  
  const tForm = useTranslations('Form')
  const tFooter = useTranslations('Footer')
  
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const form = useForm<IUserSignUp>({
    resolver: zodResolver(UserSignUpSchema),
    defaultValues: signUpDefaultValues,
  })

  const { control, handleSubmit } = form

  const onSubmit = async (data: IUserSignUp) => {
    try {
      const res = await registerUser(data)
      if (!res.success) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Success',
        description: 'Account created successfully!, A verification Email was sent',
      })
      await signInWithCredentials({
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
        description: tForm('Invalid email or password'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* <input type='hidden' name='callbackUrl' value={callbackUrl} /> */}
        <div className='space-y-6'>
          <FormField
            control={control}
            name='name'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{tForm('Name')}</FormLabel>
                <FormControl>
                  <Input placeholder={tForm('Enter Name')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name='email'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{tForm('Email')}</FormLabel>
                <FormControl>
                  <Input placeholder={tForm('Enter email address')} {...field} />
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
                <FormLabel>{tForm('Password')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={tForm('Enter password')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>{tForm('Confirm Password')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={tForm('Confirm Password')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <Button type='submit'>{tForm('Sign Up')}</Button>
          </div>
          <div className='text-sm'>
            {tForm('By creating an account, you agree to')} {site.name}&apos;s{' '}
            <Link href='/page/conditions-of-use'> {tFooter('Conditions of Use')}. </Link> and{' '}
            <Link href='/page/privacy-policy'> {tFooter('Privacy Notice')}. </Link>
          </div>
          <Separator className='mb-4' />
          <div className='text-sm'>
            {tForm('Already have an account')}?{' '}
            <Link className='link' href={`/sign-in?callbackUrl=${callbackUrl}`}>
              {tForm('Sign In')}
            </Link>
          </div>
        </div>
      </form>
    </Form>
  )
}