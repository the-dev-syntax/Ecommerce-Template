'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { revokeAllSessions } from '@/lib/actions/user.actions'

export function RevokeSessionsButton() {
  const t = useTranslations()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, setIsPending] = useState(false)

  async function handleRevoke() {
    if (isPending) return
    setIsPending(true)

    const res = await revokeAllSessions()

    if (!res.success) {
      setIsPending(false)
      return toast({
        variant: 'destructive',
        description: res.message,
      })
    }

    await signOut({ redirect: false })
    toast({ description: res.message })
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <Button
      className='rounded-full w-48'
      variant='outline'
      onClick={handleRevoke}
      disabled={isPending}
    >
      {isPending ? t('Submitting') : t('Sign out everywhere')}
    </Button>
  )
}
