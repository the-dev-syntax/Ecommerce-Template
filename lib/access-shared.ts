import type { UserRole } from '@/types'

export const isAdminRole = (
  role: UserRole | string | null | undefined
): boolean => role === 'admin'

export const isAdminOrOwner = (
  currentUserId: string | undefined,
  currentUserRole: UserRole | string | undefined,
  orderUserId: string | undefined | null
): boolean => {
  if (isAdminRole(currentUserRole)) return true
  if (!currentUserId || !orderUserId) return false
  return String(currentUserId) === String(orderUserId)
}

/** True when the session belongs to a user whose email is verified. */
export const isVerifiedUser = (
  session: { user?: { emailVerified?: unknown } | null } | null
): boolean => Boolean(session?.user?.emailVerified)

export const isEmailVerified = isVerifiedUser
