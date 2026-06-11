import type {BottomTabBarProps} from '@react-navigation/bottom-tabs'
import {
  NavigationContainer,
  type NavigationContainerRef,
  useNavigationContainerRef,
} from '@react-navigation/native'
import type {ReactElement} from 'react'
import {useCallback, useState} from 'react'
import {Platform, StyleSheet, Text, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {FloatingNavBar} from '@/components/FloatingNavBar'
import {MapView} from '@/components/MapView'
import {MAP_ATTRIBUTION} from '@/constants/map'
import {useMapAppearance} from '@/hooks/useMapAppearance'
import {FLOATING_NAV_HEIGHT, FLOATING_NAV_MARGIN} from '@/navigation/layout'
import type {RootTabParamList} from '@/navigation/linking'
import {linking} from '@/navigation/linking'
import {RootNavigator} from '@/navigation/RootNavigator'
import type {RootTabRouteName} from '@/navigation/routes'

/**
 * App shell: persistent map layer with navigation and attribution overlays.
 * The map never unmounts when switching tabs.
 */
export function AppShell(): ReactElement {
  const navigationRef = useNavigationContainerRef<RootTabParamList>()
  const [tabBarProps, setTabBarProps] = useState<BottomTabBarProps | null>(null)
  const [activeRoute, setActiveRoute] = useState<RootTabRouteName>('Map')

  const handleTabBarChange = useCallback((props: BottomTabBarProps): void => {
    setTabBarProps(props)
  }, [])

  const syncActiveRoute = useCallback(
    (ref: NavigationContainerRef<RootTabParamList> | null): void => {
      const routeName = ref?.getCurrentRoute()?.name as RootTabRouteName | undefined
      if (routeName) {
        setActiveRoute(routeName)
      }
    },
    [],
  )

  const handleNavigationReady = useCallback((): void => {
    syncActiveRoute(navigationRef.current)
  }, [navigationRef, syncActiveRoute])

  const handleNavigationStateChange = useCallback((): void => {
    syncActiveRoute(navigationRef.current)
  }, [navigationRef, syncActiveRoute])

  return (
    <NavigationContainer
      linking={linking}
      onReady={handleNavigationReady}
      onStateChange={handleNavigationStateChange}
      ref={navigationRef}>
      <AppShellBody
        activeRoute={activeRoute}
        onTabBarChange={handleTabBarChange}
        tabBarProps={tabBarProps}
      />
    </NavigationContainer>
  )
}

type AppShellBodyProps = {
  activeRoute: RootTabRouteName
  tabBarProps: BottomTabBarProps | null
  onTabBarChange: (props: BottomTabBarProps) => void
}

/** Map, navigation scenes, and floating tab bar once navigation state is available. */
function AppShellBody({activeRoute, tabBarProps, onTabBarChange}: AppShellBodyProps): ReactElement {
  const appearance = useMapAppearance()
  const insets = useSafeAreaInsets()
  const isDark = appearance === 'dark'
  const isWeb = Platform.OS === 'web'

  // Raise the map above transparent nav scenes so pan/zoom reach MapLibre on web and native.
  const mapInteractive = activeRoute === 'Map'

  // Keep attribution above the bottom nav on native; near bottom-left on web.
  const attributionBottom = isWeb
    ? 8 + insets.bottom
    : FLOATING_NAV_HEIGHT + FLOATING_NAV_MARGIN + insets.bottom

  return (
    <View style={styles.container}>
      <View
        style={[styles.mapLayer, mapInteractive ? styles.mapLayerInteractive : null]}
        pointerEvents={mapInteractive ? 'box-none' : 'none'}>
        <MapView />
      </View>
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
      <View style={styles.navigationLayer} pointerEvents={mapInteractive ? 'none' : 'box-none'}>
        <RootNavigator onTabBarChange={onTabBarChange} />
      </View>
      {tabBarProps ? (
        <View style={styles.tabBarLayer} pointerEvents="box-none">
          <FloatingNavBar {...tabBarProps} />
        </View>
      ) : null}
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
    zIndex: 25,
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
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  mapLayerInteractive: {
    zIndex: 15,
  },
  navigationLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  tabBarLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
})
