'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import useColorStore from '@/hooks/use-color-store'


export function ColorProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {

  const { theme } = useTheme()

  const { color, updateCssVariables } = useColorStore(theme)

  React.useEffect(() => {
    updateCssVariables()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, color])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

/*
the return of themeProvider looks like that :
return (
    <NextThemesProvider {...props}>
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
    </NextThemesProvider>
if we combined the two returns , , explain to me 
*/