
// RECOMMENDED SOLUTION

import { useEffect } from 'react'
import useSettingStore from '@/hooks/use-setting-store'
import { ClientSetting } from '@/types'

export default function SettingsInitializer({
  setting,
}: {
  setting: ClientSetting
}) {
  // Synchronize the server-provided `setting` prop with the client store.
  //
  // This must stay a regular effect: a layout effect runs during hydration and
  // can update the shared store before sibling client components hydrate, so
  // they render the cookie currency while the server HTML used the default —
  // a hydration mismatch (seen on ProductPrice). useEffect runs after the
  // whole tree has hydrated, so the currency swap is visible but safe.
  useEffect(() => {
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