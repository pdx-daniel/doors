import {OverlayProvider} from '@gluestack-ui/core/overlay/creator'
import {ToastProvider} from '@gluestack-ui/core/toast/creator'
import type React from 'react'
import {useEffect} from 'react'
import {View, type ViewProps} from 'react-native'

import {script} from './script'

/** Color scheme modes supported by the root UI provider. */
export type ModeType = 'light' | 'dark' | 'system'

/**
 * Web gluestack provider: toggles document theme classes instead of RN Appearance APIs.
 */
export function GluestackUIProvider({
  mode = 'system',
  ...props
}: {
  mode?: ModeType
  children?: React.ReactNode
  style?: ViewProps['style']
}) {
  useEffect(() => {
    // Apply the requested color scheme to the document root for Tailwind dark mode.
    script(mode)
  }, [mode])

  useEffect(() => {
    // Re-sync when the OS preference changes while mode is "system".
    if (mode !== 'system') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (): void => {
      script('system')
    }

    mediaQuery.addEventListener('change', handleChange)
    return (): void => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [mode])

  return (
    <View style={[{flex: 1, height: '100%', width: '100%'}, props.style]}>
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  )
}
