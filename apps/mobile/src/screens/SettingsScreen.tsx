import {useIsFocused} from '@react-navigation/native'
import type {ReactElement} from 'react'
import {Platform, ScrollView, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {Box} from '@/components/ui/box'
import {Text} from '@/components/ui/text'
import {getFloatingNavContentInsets} from '@/navigation/layout'

/**
 * Full-page settings route. Opaque background covers the map; the floating nav
 * bar renders above this screen via the tab navigator.
 */
export function SettingsScreen(): ReactElement {
  const isFocused = useIsFocused()
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === 'web'

  // Tab screens stay mounted when inactive — avoid showing settings while blurred.
  if (!isFocused) {
    return <View style={styles.hidden} pointerEvents="none" />
  }

  const contentInsets = getFloatingNavContentInsets(insets, isWeb)

  return (
    <Box className="flex-1 bg-gray-950" style={contentInsets}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text className="text-2xl font-bold text-gray-50">Settings</Text>
        <Text className="mt-2 text-sm text-gray-400">
          App preferences and account options will live here.
        </Text>
        <Box className="mt-6 rounded-xl border border-white/10 bg-gray-900/60 px-4 py-4">
          <Text className="text-sm font-medium text-gray-200">Appearance</Text>
          <Text className="mt-1 text-sm text-gray-400">Follows system light/dark appearance</Text>
        </Box>
        <Box className="mt-3 rounded-xl border border-white/10 bg-gray-900/60 px-4 py-4">
          <Text className="text-sm font-medium text-gray-200">About</Text>
          <Text className="mt-1 text-sm text-gray-400">Doors · map-first exploration</Text>
        </Box>
      </ScrollView>
    </Box>
  )
}

/** Collapsed placeholder while the settings tab is inactive. */
const styles = StyleSheet.create({
  hidden: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
})
