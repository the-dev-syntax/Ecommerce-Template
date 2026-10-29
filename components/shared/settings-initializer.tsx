
// RECOMMENDED SOLUTION

import { useEffect, useLayoutEffect } from 'react'
import useSettingStore from '@/hooks/use-setting-store'
import { ClientSetting } from '@/types'

// useState/setState in a layout effect is applied before the browser paints,
// so server-rendered prices switch to the cookie currency without a visible
// flash. useEffect runs after paint and briefly showed the default currency.
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
  }, [setting]) // We include `setting` as a dependency.

  // This component's only job is to run the effect.
  return null
}


/* 
that was the original code:
import React, { useEffect, useState } from 'react'
import useSettingStore from '@/hooks/use-setting-store'
import { ClientSetting } from '@/types'

export default function SettingsInitializer({
  setting,
  children,
}: {
  setting: ClientSetting
  children: React.ReactNode
}) {
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    setRendered(true)
  }, [setting])

  // at the first render, update the Zustand store from cache or database.
  if (!rendered) {
    useSettingStore.setState({
      setting,
    })
  }

  return children
}
  */