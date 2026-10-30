'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  startPhoneVerification,
  verifyPhoneCode,
} from '@/lib/actions/phone.actions'
import { SAUDI_PHONE_PREFIX, saudiPhoneNational } from '@/lib/phone'

type PhoneVerificationProps = {
  value?: string
  onChange: (value: string) => void
  verifiedPhones?: string[]
  onVerified?: (phone: string) => void
  disabled?: boolean
}

/**
 * Locked +966 phone field with a Tawked SMS OTP step.
 *
 * The form value is emitted as the 9 national digits while typing, then as
 * E.164 (`+9665XXXXXXXX`) after a successful verification.
 */
export default function PhoneVerification({
  value,
  onChange,
  verifiedPhones = [],
  onVerified,
  disabled,
}: PhoneVerificationProps) {
  const t = useTranslations()
  const locale = useLocale()
  const { toast } = useToast()

  const [digits, setDigits] = useState(() => saudiPhoneNational(value) ?? '')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const e164 = digits.length === 9 ? `${SAUDI_PHONE_PREFIX}${digits}` : ''
  const isVerified = !!e164 && verifiedPhones.includes(e164)

  // Reflect external changes (saved address selected, form reset).
  useEffect(() => {
    const next = saudiPhoneNational(value) ?? ''
    setDigits((current) => {
      if (next && next !== current) {
        setSent(false)
        setCode('')
        return next
      }
      return current
    })
  }, [value])

  const updateDigits = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, 9)
    setDigits(next)
    setSent(false)
    setCode('')
    onChange(next)
  }

  const sendCode = async () => {
    if (digits.length !== 9) {
      toast({
        variant: 'destructive',
        description: t('Enter the 9-digit number after +966'),
      })
      return
    }

    setIsSending(true)
    try {
      const result = await startPhoneVerification({
        phone: e164,
        lang: locale === 'en-US' ? 'en' : 'ar',
      })

      if (!result.success) {
        toast({ variant: 'destructive', description: result.message })
        return
      }

      if (result.alreadyVerified) {
        onChange(e164)
        onVerified?.(e164)
        toast({ description: result.message })
        return
      }

      setSent(true)
      toast({ description: result.message })
    } finally {
      setIsSending(false)
    }
  }

  const confirmCode = async () => {
    if (!/^\d{4,8}$/.test(code)) {
      toast({
        variant: 'destructive',
        description: t('Enter the 6-digit code'),
      })
      return
    }

    setIsVerifying(true)
    try {
      const result = await verifyPhoneCode({ code })
      if (!result.success) {
        toast({ variant: 'destructive', description: result.message })
        return
      }

      setSent(false)
      setCode('')
      onChange(e164)
      onVerified?.(e164)
      toast({ description: t('Phone number verified') })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-stretch'>
        <span className='inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm'>
          {SAUDI_PHONE_PREFIX}
        </span>
        <Input
          value={digits}
          onChange={(event) => updateDigits(event.target.value)}
          inputMode='numeric'
          autoComplete='tel-national'
          maxLength={9}
          placeholder='5XXXXXXXX'
          disabled={disabled || isVerified}
          className='rounded-l-none'
          aria-label={t('Phone number')}
        />
        {isVerified && (
          <CheckCircle2Icon className='mx-2 h-5 w-5 self-center text-green-600' />
        )}
      </div>

      <p className='text-xs text-muted-foreground'>
        {t('Enter the 9-digit number after +966')}
      </p>

      {isVerified ? (
        <p className='text-xs text-green-600'>{t('Verified')}</p>
      ) : (
        digits.length === 9 && (
          <div className='space-y-2'>
            {sent && (
              <Input
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 8))
                }
                inputMode='numeric'
                autoComplete='one-time-code'
                maxLength={8}
                placeholder={t('Enter the 6-digit code')}
              />
            )}
            <div className='flex flex-wrap gap-2'>
              {sent ? (
                <>
                  <Button
                    type='button'
                    onClick={confirmCode}
                    disabled={isVerifying}
                  >
                    {isVerifying ? t('Saving') : t('Confirm code')}
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={sendCode}
                    disabled={isSending}
                  >
                    {isSending ? t('Sending') : t('Send a new code')}
                  </Button>
                </>
              ) : (
                <Button
                  type='button'
                  variant='outline'
                  onClick={sendCode}
                  disabled={isSending || disabled}
                >
                  {isSending ? t('Sending') : t('Verify phone number')}
                </Button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}
