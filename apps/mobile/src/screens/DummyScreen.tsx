import {useIsFocused} from '@react-navigation/native'
import type {ReactElement} from 'react'
import {Platform, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {Box} from '@/components/ui/box'
import {Text} from '@/components/ui/text'

type DummyScreenProps = {
  title: string
  description: string
}

/** Approximate height of the floating nav bar including vertical padding. */
const FLOATING_NAV_HEIGHT = 56

/**
 * Placeholder overlay panel shown over the persistent map for non-map tabs.
 * Insets from the floating nav bar (top on web, bottom on native).
 */
export function DummyScreen({title, description}: DummyScreenProps): ReactElement {
  const isFocused = useIsFocused()
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === 'web'

  // Tab screens stay mounted when inactive — hide the overlay when blurred.
  if (!isFocused) {
    return <View style={styles.container} pointerEvents="none" />
  }

  // Leave room for the floating nav bar and safe-area insets.
  const panelStyle = isWeb
    ? {
        top: insets.top + FLOATING_NAV_HEIGHT + 16,
        bottom: insets.bottom + 16,
      }
    : {
        top: insets.top + 16,
        bottom: insets.bottom + FLOATING_NAV_HEIGHT + 16,
      }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Box
        className="absolute inset-x-4 rounded-xl border border-white/10 bg-gray-900/90 px-4 py-5 shadow-lg"
        style={panelStyle}>
        <Text className="text-lg font-semibold text-gray-50">{title}</Text>
        <Text className="mt-2 text-sm text-gray-300">{description}</Text>
      </Box>
    </View>
  )
}

/** Transparent full-screen wrapper so map gestures pass through outside the panel. */
const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1,
  },
})
