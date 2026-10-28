'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useSession } from 'next-auth/react'
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
import { updateUserEmail } from '@/lib/actions/user.actions'
import { UserEmailSchema } from '@/lib/validator'
import { IUserEmail } from '@/types'



export const EmailForm = () => {
  const tForm = useTranslations()
  const tProduct = useTranslations()
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const form = useForm<IUserEmail>({
    resolver: zodResolver(UserEmailSchema),
    defaultValues: {
      email: session?.user?.email ?? '',
      currentPassword: '',
    },
  })

  async function onSubmit(values: IUserEmail) {
        if (!session) {
      return toast({
        variant: 'destructive',
        description: tForm('SessionExpired'),
      })
    }    
    const res = await updateUserEmail(values)
 
    if (!res.success) {
      return toast({
        variant: 'destructive',
        description: res.message,
      })
    }

    const { message } = res
    toast({
      description: message,
    })

    // The email only changes after the OTP sent to the new address is
    // verified, so send the user to the verification screen.
    router.push('/verify-email')
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-col gap-5'
      >
        <div className='flex flex-col gap-5'>
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel className='font-bold'>{tForm('New email')}</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    placeholder={tForm('Email')}
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
            name='currentPassword'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel className='font-bold'>
                  {tForm('Current Password')}
                </FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={tForm('Current Password')}
                    {...field}
                    className='input-field'
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type='submit'
          size='lg'
          disabled={form.formState.isSubmitting}
          className='button col-span-2 w-full'
        >
          {form.formState.isSubmitting ? tProduct('Submitting') : tProduct('Save Changes')}
        </Button>
      </form>
    </Form>
  )
}