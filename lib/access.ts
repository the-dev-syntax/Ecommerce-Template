import 'server-only'
import type { UserRole } from '@/types'

import { isAdminOrOwner, isAdminRole, isVerifiedUser } from './access-shared'

export { isAdminOrOwner, isVerifiedUser, isEmailVerified } from './access-shared'

export const requireAdmin = (
  session: { user?: { role?: UserRole | string | null } | null } | null
): void => {
  if (!session || !isAdminRole(session.user?.role))
    throw new Error('Admin permission required')
}

export const requireVerifiedUser = (
  session: { user?: { id?: string; emailVerified?: unknown } | null } | null
): void => {
  if (!session?.user?.id) throw new Error('Authentication required')
  if (!isVerifiedUser(session)) throw new Error('Email verification required')
}
