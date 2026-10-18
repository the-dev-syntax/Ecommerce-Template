'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
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
import { resetPassword } from '@/lib/actions/user.actions'
import { ResetPasswordSchema } from '@/lib/validator'
import { IResetPassword } from '@/types'

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations()
  const router = useRouter()
  const { toast } = useToast()

  const form = useForm<IResetPassword>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      token,
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: IResetPassword) {
    const res = await resetPassword(values)

    if (!res.success) {
      return toast({
        variant: 'destructive',
        description: res.message,
      })
    }

    toast({
      description: res.message,
    })
    router.push('/sign-in')
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-col gap-5'
      >
        <FormField
          control={form.control}
          name='newPassword'
          render={({ field }) => (
            <FormItem className='w-full'>
              <FormLabel className='font-bold'>{t('New Password')}</FormLabel>
              <FormControl>
                <Input
                  type='password'
                  placeholder={t('Enter password')}
                  autoComplete='new-password'
                  {...field}
                  className='input-field'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem className='w-full'>
              <FormLabel className='font-bold'>
                {t('Confirm Password')}
              </FormLabel>
              <FormControl>
                <Input
                  type='password'
                  placeholder={t('Confirm Password')}
                  autoComplete='new-password'
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
            : t('Reset Password')}
        </Button>
      </form>
    </Form>
  )
}
