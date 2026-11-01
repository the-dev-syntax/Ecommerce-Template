'use client'

import { useEffect, useLayoutEffect } from 'react'

import useSettingStore from '@/hooks/use-setting-store'
import { ClientSetting } from '@/types'

// useLayoutEffect on the client, useEffect on the server (where layout effects
// do nothing and trigger a warning). The server still renders with the store
// defaults, but the client swaps to the server-selected (cookie) currency
// before the first paint, removing the visible currency flash.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

export default function SettingsInitializer({
  setting,
}: {
  setting: ClientSetting
}) {
  // Synchronize the server-provided `setting` prop with the client store.
  useIsomorphicLayoutEffect(() => {
    useSettingStore.setState({ setting })
  }, [setting])

  return null
}
