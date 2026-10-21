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
