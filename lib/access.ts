import 'server-only'
import type { UserRole } from '@/types'


const isAdmin = (role: UserRole | string | null | undefined): boolean =>
  role === 'admin'

export const isAdminOrOwner = (
  currentUserId: string | undefined,
  currentUserRole: UserRole | string | undefined,
  orderUserId: string | undefined | null
): boolean => {
  if (!currentUserId || !orderUserId) return false
  if (isAdmin(currentUserRole)) return true
  return currentUserId === orderUserId
}

export const requireAdmin = (
  session: { user?: { role?: UserRole | string | null } | null } | null
): void => {
  if (!session || !isAdmin(session.user?.role))
    throw new Error('Admin permission required')
}