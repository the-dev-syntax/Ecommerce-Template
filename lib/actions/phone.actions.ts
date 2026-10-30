'use server'

import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/db'
import User from '@/lib/db/models/user.model'
import { normalizeSaudiPhone } from '@/lib/phone'
import {
  getClientIp,
  limitPhoneVerificationCheck,
  limitPhoneVerificationStart,
} from '@/lib/rate-limit'
import {
  TawkedError,
  checkTawkedVerification,
  startTawkedVerification,
  tawkedErrorMessage,
} from '@/lib/tawked'
import { formatError } from '@/lib/utils'

const OTP_CODE_RE = /^\d{4,8}$/

export type PhoneActionResult = {
  success: boolean
  message: string
  alreadyVerified?: boolean
  data?: {
    phone?: string
    expiresAt?: string
    status?: string
    attemptsRemaining?: number
  }
}

async function requireUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('User not authenticated')
  return session.user.id
}

/** Verified E.164 numbers for the signed-in user (used by checkout/address UI). */
export async function getVerifiedPhones(): Promise<string[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  await connectToDatabase()
  const user = await User.findById(session.user.id)
    .select({ phone: 1, phoneVerified: 1, verifiedPhones: 1 })
    .lean()

  const phones = new Set((user?.verifiedPhones ?? []).map((entry) => entry.phone))
  if (user?.phoneVerified && user.phone) phones.add(user.phone)
  return [...phones]
}

/** Send (or resend) a Tawked OTP to the given Saudi mobile number. */
export async function startPhoneVerification(input: {
  phone: string
  lang?: string
}): Promise<PhoneActionResult> {
  try {
    const userId = await requireUserId()
    const phone = normalizeSaudiPhone(input.phone)
    if (!phone)
      return {
        success: false,
        message:
          'Enter a valid Saudi mobile number (+966 followed by 9 digits).',
      }

    await limitPhoneVerificationStart(userId)
    await connectToDatabase()

    const user = await User.findById(userId)
      .select({ phone: 1, phoneVerified: 1, verifiedPhones: 1 })
      .lean()

    const verified = new Set(
      (user?.verifiedPhones ?? []).map((entry) => entry.phone)
    )
    if (user?.phoneVerified && user.phone) verified.add(user.phone)
    if (verified.has(phone)) {
      return {
        success: true,
        message: 'This phone number is already verified.',
        alreadyVerified: true,
        data: { phone },
      }
    }

    // The id stays on the server; the browser only ever sees "code sent".
    const clientIp = await getClientIp().catch(() => undefined)
    const started = await startTawkedVerification({
      to: phone,
      lang: input.lang,
      reference: `phone:${userId}`,
      clientIp,
    })

    const expiresAt = started.expiresAt
      ? new Date(started.expiresAt)
      : new Date(Date.now() + 5 * 60 * 1000)

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          phoneOtpId: started.id,
          phoneOtpPhone: phone,
          phoneOtpExpires: expiresAt,
        },
      }
    )

    return {
      success: true,
      message: 'Verification code sent',
      data: { phone, expiresAt: expiresAt.toISOString() },
    }
  } catch (error) {
    if (error instanceof TawkedError) {
      console.error('Tawked start failed:', error.code, error.status)
      return { success: false, message: tawkedErrorMessage(error.code) }
    }
    return { success: false, message: formatError(error) }
  }
}

async function clearPendingPhoneOtp(userId: string) {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        phoneOtpId: null,
        phoneOtpPhone: null,
        phoneOtpExpires: null,
      },
    }
  )
}

/** Check the OTP with Tawked and persist phoneVerified on success. */
export async function verifyPhoneCode(input: {
  code: string
}): Promise<PhoneActionResult> {
  try {
    const userId = await requireUserId()
    const code = String(input.code ?? '').trim()
    if (!OTP_CODE_RE.test(code))
      return { success: false, message: 'Enter the code from the SMS.' }

    await limitPhoneVerificationCheck(userId)
    await connectToDatabase()

    const user = await User.findById(userId)
      .select(
        '+phoneOtpId +phoneOtpPhone +phoneOtpExpires phone phoneVerified verifiedPhones'
      )
      .lean()

    const pendingId = user?.phoneOtpId
    const pendingPhone = user?.phoneOtpPhone
    if (!pendingId || !pendingPhone)
      return { success: false, message: 'Request a new code.' }

    if (
      user?.phoneOtpExpires &&
      new Date(user.phoneOtpExpires).getTime() < Date.now()
    ) {
      await clearPendingPhoneOtp(userId)
      return {
        success: false,
        message: 'This code has expired. Request a new one.',
      }
    }

    const result = await checkTawkedVerification({ id: pendingId, code })

    if (result.verified) {
      const verifiedAt = new Date()
      const verifiedPhones = [
        ...(user?.verifiedPhones ?? [])
          .filter((entry) => entry.phone !== pendingPhone)
          .map((entry) => ({
            phone: entry.phone,
            verifiedAt: new Date(entry.verifiedAt),
          })),
        { phone: pendingPhone, verifiedAt },
      ]

      await User.updateOne(
        { _id: userId },
        {
          $set: {
            phone: pendingPhone,
            phoneVerified: true,
            phoneVerifiedAt: verifiedAt,
            verifiedPhones,
            phoneOtpId: null,
            phoneOtpPhone: null,
            phoneOtpExpires: null,
          },
        }
      )

      return {
        success: true,
        message: 'Phone number verified',
        data: { phone: pendingPhone },
      }
    }

    // Terminal states close the Tawked verification; a new start is needed.
    if (
      ['too_many_attempts', 'expired', 'failed', 'canceled'].includes(
        result.status
      )
    )
      await clearPendingPhoneOtp(userId)

    const attempts = result.attemptsRemaining
    const message =
      result.status === 'invalid_code'
        ? `Invalid code.${typeof attempts === 'number' ? ` ${attempts} attempts left.` : ''}`
        : result.status === 'too_many_attempts'
          ? 'Too many attempts. Request a new code.'
          : result.status === 'expired'
            ? 'This code has expired. Request a new one.'
            : 'This verification failed. Request a new code.'

    return {
      success: false,
      message,
      data: { status: result.status, attemptsRemaining: attempts },
    }
  } catch (error) {
    if (error instanceof TawkedError) {
      console.error('Tawked check failed:', error.code, error.status)
      return { success: false, message: tawkedErrorMessage(error.code) }
    }
    return { success: false, message: formatError(error) }
  }
}
