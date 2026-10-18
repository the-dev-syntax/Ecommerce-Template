import { connectToDatabase } from '@/lib/db'
import User from '@/lib/db/models/user.model'
import { MAX_BROWSING_HISTORY } from '@/lib/constants'

export { MAX_BROWSING_HISTORY }

export type BrowsingHistoryItem = { productId: string; category: string }

// Merge incoming items (local, recency order) first, then existing DB items,
// dropping duplicates and capping at MAX_BROWSING_HISTORY.
export async function mergeBrowsingHistory(
  userId: string,
  items: BrowsingHistoryItem[]
) {
  await connectToDatabase()

  const user = await User.findById(userId).select('browsingHistory')
  if (!user) return

  const existing: BrowsingHistoryItem[] = (user.browsingHistory ?? []).map(
    (h) => ({
      productId: String(h.product),
      category: h.category,
    })
  )

  const merged: BrowsingHistoryItem[] = []
  const seen = new Set<string>()
  const incoming = Array.isArray(items)
    ? items.slice(0, MAX_BROWSING_HISTORY)
    : []

  for (const item of [...incoming, ...existing]) {
    if (!item?.productId || !/^[0-9a-fA-F]{24}$/.test(item.productId)) continue
    if (typeof item.category !== 'string') continue
    if (seen.has(item.productId)) continue
    seen.add(item.productId)
    merged.push({
      productId: item.productId,
      category: item.category.trim().slice(0, 100),
    })
    if (merged.length >= MAX_BROWSING_HISTORY) break
  }

  user.browsingHistory = merged.map((item) => ({
    product: item.productId,
    category: item.category,
    viewedAt: new Date(),
  }))

  await user.save()
}
