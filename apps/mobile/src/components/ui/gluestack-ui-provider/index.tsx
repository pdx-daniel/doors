import {OverlayProvider} from '@gluestack-ui/core/overlay/creator'
import {ToastProvider} from '@gluestack-ui/core/toast/creator'
import type React from 'react'
import {useEffect} from 'react'
import {Appearance, type ColorSchemeName, View, type ViewProps} from 'react-native'

/** Color scheme modes supported by the root UI provider. */
export type ModeType = 'light' | 'dark' | 'system'

/**
 * Root gluestack provider: theme mode, overlays, and toasts for the app shell.
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
    Appearance.setColorScheme(mode as ColorSchemeName)
  }, [mode])

  return (
    <View style={[{flex: 1, height: '100%', width: '100%'}, props.style]}>
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  )
}
