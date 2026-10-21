'use client'
import useBrowsingHistory from '@/hooks/use-browsing-history'
import useSettingStore from '@/hooks/use-setting-store'
import { markBrowsingHistoryDirty } from '@/lib/sync-browsing-history'
import { useEffect } from 'react'

export default function AddToBrowsingHistory({
  id,
  category,
}: {
  id: string
  category: string
}) {
  const { addItem } = useBrowsingHistory()
  const { setting: { features } } = useSettingStore()
  useEffect(() => {
    if (!features.browsingHistory) return
    addItem({ id, category })
    markBrowsingHistoryDirty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
