import {NavigationContainer} from '@react-navigation/native'
import type {ReactElement} from 'react'
import {Platform, StyleSheet, Text, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {MapView} from '@/components/MapView'
import {MAP_ATTRIBUTION} from '@/constants/map'
import {useMapAppearance} from '@/hooks/useMapAppearance'
import {linking} from '@/navigation/linking'
import {RootNavigator} from '@/navigation/RootNavigator'

/** Approximate height of the floating nav bar plus its bottom margin on native. */
const NATIVE_NAV_CLEARANCE = 72

/**
 * App shell: persistent map layer with navigation and attribution overlays.
 * The map never unmounts when switching tabs.
 */
export function AppShell(): ReactElement {
  const appearance = useMapAppearance()
  const insets = useSafeAreaInsets()
  const isDark = appearance === 'dark'
  const isWeb = Platform.OS === 'web'

  // Keep attribution above the bottom nav on native; near bottom-left on web.
  const attributionBottom = isWeb ? 8 + insets.bottom : NATIVE_NAV_CLEARANCE + insets.bottom

  return (
    <View style={styles.container}>
      <MapView />
      <View
        style={[
          styles.attribution,
          {bottom: attributionBottom},
          isDark ? styles.attributionDark : styles.attributionLight,
        ]}
        pointerEvents="none">
        <Text
          style={[
            styles.attributionText,
            isDark ? styles.attributionTextDark : styles.attributionTextLight,
          ]}>
          {MAP_ATTRIBUTION}
        </Text>
      </View>
      <View style={styles.navigationLayer} pointerEvents="box-none">
        <NavigationContainer linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </View>
    </View>
  )
}

/** Full-screen layout with map at z-index 0 and navigation above. */
const styles = StyleSheet.create({
  attribution: {
    left: 8,
    maxWidth: '80%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    zIndex: 5,
  },
  attributionDark: {
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
  },
  attributionLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  attributionText: {
    fontSize: 10,
    lineHeight: 14,
  },
  attributionTextDark: {
    color: '#e5e7eb',
  },
  attributionTextLight: {
    color: '#374151',
  },
  container: {
    flex: 1,
    minHeight: 0,
  },
  navigationLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
})
