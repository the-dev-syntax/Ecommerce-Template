'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useToast } from '@/hooks/use-toast'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { requestPasswordReset } from '@/lib/actions/user.actions'
import { RequestPasswordResetSchema } from '@/lib/validator'
import { IRequestPasswordReset } from '@/types'

export function ForgotPasswordForm() {
  const t = useTranslations()
  const { toast } = useToast()
  const [sent, setSent] = useState(false)

  const form = useForm<IRequestPasswordReset>({
    resolver: zodResolver(RequestPasswordResetSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(values: IRequestPasswordReset) {
    const res = await requestPasswordReset(values)

    if (!res.success) {
      return toast({
        variant: 'destructive',
        description: res.message,
      })
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className='flex flex-col gap-4'>
        <p className='text-sm'>
          {t(
            'If an account exists for that email, a reset link has been sent.'
          )}
        </p>
        <Link href='/sign-in'>
          <Button className='w-full' variant='outline'>
            {t('Back to Sign In')}
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-col gap-5'
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem className='w-full'>
              <FormLabel className='font-bold'>{t('Email')}</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  placeholder={t('Enter email address')}
                  autoComplete='email'
                  {...field}
                  className='input-field'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type='submit'
          size='lg'
          disabled={form.formState.isSubmitting}
          className='button w-full'
        >
          {form.formState.isSubmitting
            ? t('Submitting')
            : t('Send Reset Link')}
        </Button>
      </form>
    </Form>
  )
}
