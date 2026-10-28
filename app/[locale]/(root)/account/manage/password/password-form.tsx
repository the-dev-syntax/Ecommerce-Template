'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useRouter } from '@/i18n/routing'
import { signOut } from 'next-auth/react'
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
import { updateUserPassword } from '@/lib/actions/user.actions'
import { ChangePasswordSchema } from '@/lib/validator'
import { IChangePassword } from '@/types'

export function PasswordForm() {
  const t = useTranslations()
  const router = useRouter()
  const { toast } = useToast()

  const form = useForm<IChangePassword>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: IChangePassword) {
    const res = await updateUserPassword(values)

    if (!res.success) {
      return toast({
        variant: 'destructive',
        description: res.message,
      })
    }

    // The password change invalidates this JWT on the next session read;
    // sign out explicitly so the user lands on a clean sign-in page.
    await signOut({ redirect: false })
    form.reset()
    toast({
      description: res.message,
    })
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-col gap-5'
      >
        <FormField
          control={form.control}
          name='currentPassword'
          render={({ field }) => (
            <FormItem className='w-full'>
              <FormLabel className='font-bold'>
                {t('Current Password')}
              </FormLabel>
              <FormControl>
                <Input
                  type='password'
                  placeholder={t('Enter password')}
                  autoComplete='current-password'
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
          className='button col-span-2 w-full'
        >
          {form.formState.isSubmitting
            ? t('Submitting')
            : t('Save Changes')}
        </Button>
      </form>
    </Form>
  )
}
