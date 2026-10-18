import { browsingHistoryStore } from '@/hooks/use-browsing-history'
import { syncBrowsingHistory } from '@/lib/actions/browsing-history.actions'

let dirty = false
let intervalStarted = false

export function markBrowsingHistoryDirty() {
  dirty = true
}

export function clearBrowsingHistoryDirty() {
  dirty = false
}

function localItems() {
  return browsingHistoryStore
    .getState()
    .products.map((p) => ({ productId: p.id, category: p.category }))
}

async function syncNow() {
  if (!dirty) return
  const items = localItems()
  dirty = false
  const res = await syncBrowsingHistory(items)
  if (!res?.success) dirty = true
}

// Fire-and-forget flush for tab close / session end.
export function flushBrowsingHistoryBeacon() {
  if (!dirty) return
  const items = localItems()
  if (items.length === 0) return
  const blob = new Blob([JSON.stringify({ items })], {
    type: 'application/json',
  })
  navigator.sendBeacon('/api/browsing-history', blob)
  dirty = false
}

// Awaitable flush (used on sign-out).
export async function flushBrowsingHistoryNow() {
  await syncNow()
}

export function startBrowsingHistorySync() {
  if (intervalStarted) return
  intervalStarted = true
  window.setInterval(syncNow, 30_000)
  window.addEventListener('pagehide', flushBrowsingHistoryBeacon)
}
