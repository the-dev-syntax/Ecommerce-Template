import 'server-only'
import type { UserRole } from '@/types'

import { isAdminOrOwner, isAdminRole } from './access-shared'

export { isAdminOrOwner }

export const requireAdmin = (
  session: { user?: { role?: UserRole | string | null } | null } | null
): void => {
  if (!session || !isAdminRole(session.user?.role))
    throw new Error('Admin permission required')
}
