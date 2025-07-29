
// RECOMMENDED SOLUTION

import { useEffect } from 'react'
import useSettingStore from '@/hooks/use-setting-store'
import { ClientSetting } from '@/types'

export default function SettingsInitializer({
  setting,
}: {
  setting: ClientSetting
}) {
  // This useEffect hook will run on the client after the component mounts.
  // Its job is to synchronize the server-provided `setting` prop
  // with the client-side Zustand store.
  useEffect(() => {
    useSettingStore.setState({ setting })
  }, [setting]) // We include `setting` as a dependency.

  // This component's only job is to run the effect.
  // It should not render anything itself or wrap children.
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