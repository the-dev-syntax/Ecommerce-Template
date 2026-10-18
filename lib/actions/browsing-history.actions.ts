'use server'

import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/db'
import User from '@/lib/db/models/user.model'
import {
  BrowsingHistoryItem,
  mergeBrowsingHistory,
} from '@/lib/browsing-history'
import { formatError } from '@/lib/utils'

// Persist the local browsing history to the user's DB account (no-op for guests).
export async function syncBrowsingHistory(items: BrowsingHistoryItem[]) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false }

    await mergeBrowsingHistory(session.user.id, items)
    return { success: true }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// Read the user's DB browsing history (empty for guests).
export async function getBrowsingHistory(): Promise<{
  authed: boolean
  items: BrowsingHistoryItem[]
}> {
  const session = await auth()
  if (!session?.user?.id) return { authed: false, items: [] }

  await connectToDatabase()
  const user = await User.findById(session.user.id).select('browsingHistory')
  const items: BrowsingHistoryItem[] = (user?.browsingHistory ?? []).map(
    (h) => ({
      productId: String(h.product),
      category: h.category,
    })
  )
  return { authed: true, items }
}

// Clear the user's DB browsing history.
export async function clearBrowsingHistory() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false }

    await connectToDatabase()
    await User.findByIdAndUpdate(session.user.id, {
      $set: { browsingHistory: [] },
    })
    return { success: true }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}
