'use client'

import { useEffect } from 'react'
import { getBrowsingHistory } from '@/lib/actions/browsing-history.actions'
import { browsingHistoryStore } from '@/hooks/use-browsing-history'
import {
  markBrowsingHistoryDirty,
  startBrowsingHistorySync,
} from '@/lib/sync-browsing-history'
import { MAX_BROWSING_HISTORY } from '@/lib/constants'
import useSettingStore from '@/hooks/use-setting-store'

const GUARD_KEY = 'browsingHistoryHydrated'

export default function SyncBrowsingHistory() {
  const { setting: { features } } = useSettingStore()
  useEffect(() => {
    if (!features.browsingHistory) return
    startBrowsingHistorySync()

    const hydrate = async () => {
      if (sessionStorage.getItem(GUARD_KEY)) return
      const { authed, items } = await getBrowsingHistory()
      if (!authed) return
      sessionStorage.setItem(GUARD_KEY, '1')

      const local = browsingHistoryStore.getState().products
      const merged = [...local]
      const seen = new Set(local.map((p) => p.id))
      for (const item of items) {
        if (merged.length >= MAX_BROWSING_HISTORY) break
        if (seen.has(item.productId)) continue
        seen.add(item.productId)
        merged.push({ id: item.productId, category: item.category })
      }

      if (merged.length !== local.length) {
        browsingHistoryStore.setState({ products: merged })
      }
      // Push the merged (local + DB) history back so the DB has local-only items too.
      markBrowsingHistoryDirty()
    }

    hydrate()
  }, [features.browsingHistory])

  return null
}
