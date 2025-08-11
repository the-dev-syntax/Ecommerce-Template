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
  const tForm = useTranslations('Form')
  const tProduct = useTranslations('Product')
  const router = useRouter()
  const { data: session, update } = useSession()
  const { toast } = useToast()

  const form = useForm<IUserEmail>({
    resolver: zodResolver(UserEmailSchema),
    defaultValues: {
      email: session?.user?.email ?? '',
    },
  })

  async function onSubmit(values: IUserEmail) {
    // Note: In a real-world scenario, you should add a verification step.
    // The user would enter their new email, and you'd send a confirmation link
    // to that new address before making the change permanent.
    
    const res = await updateUserEmail(values)

    if (!res.success) {
      return toast({
        variant: 'destructive',
        description: res.message,
      })
    }

    const { data, message } = res
    // Update the session in the client to reflect the change immediately
    const newSession = {
      ...session,
      user: {
        ...session?.user,
        email: data.email,
      },
    }
    await update(newSession)

    toast({
      description: message,
    })
    
    router.push('/account/manage')
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