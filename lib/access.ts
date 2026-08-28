import 'server-only'
import type { UserRole } from '@/types'
import { IOrder } from './db/models/order.model'

export const isAdmin = (role: UserRole | string | null | undefined): boolean =>
  role === 'admin'

export const isAdminOrOwner = (
  currentUserId: string | undefined,
  currentUserRole: UserRole | string | undefined,
  doc: IOrder | null
): boolean => {
  if (!currentUserId || !doc?.user) return false
  if (isAdmin(currentUserRole)) return true
  const ownerId =
    typeof doc.user === 'object' && '_id' in doc.user
      ? String((doc.user as { _id: unknown })._id)
      : String(doc.user)
  return currentUserId === ownerId
}

export const requireAdmin = (
  session: { user?: { role?: UserRole | string | null } | null } | null
): void => {
  if (!session || !isAdmin(session.user?.role))
    throw new Error('Admin permission required')
}