import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs'
import {useIsFocused, useNavigation} from '@react-navigation/native'
import type {ReactElement, ReactNode} from 'react'
import {Platform, Pressable, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {Box} from '@/components/ui/box'
import {Text} from '@/components/ui/text'
import {getFloatingPanelInsets} from '@/navigation/layout'
import type {RootTabParamList} from '@/navigation/linking'
import type {RootTabRouteName} from '@/navigation/routes'

type FloatingPanelOverlayProps = {
  title: string
  description?: string
  children?: ReactNode
  /** Tab route to return to when dismissed. Defaults to Map. */
  dismissRoute?: RootTabRouteName
}

/**
 * Floating card overlay shown above the persistent map (e.g. Dummy 1).
 * Hides when the tab blurs and includes a dismiss control that navigates away.
 */
export function FloatingPanelOverlay({
  title,
  description,
  children,
  dismissRoute = 'Map',
}: FloatingPanelOverlayProps): ReactElement {
  const isFocused = useIsFocused()
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>()
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === 'web'

  // Tab screens stay mounted when inactive — hide the overlay when blurred.
  if (!isFocused) {
    return <View style={styles.container} pointerEvents="none" />
  }

  const panelInsets = getFloatingPanelInsets(insets, isWeb)

  const onDismiss = (): void => {
    navigation.navigate(dismissRoute)
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Box
        className="absolute inset-x-4 rounded-xl border border-white/10 bg-gray-900/90 px-4 py-5 shadow-lg"
        style={panelInsets}>
        <Box className="flex-row items-start justify-between gap-3">
          <Box className="min-w-0 flex-1">
            <Text className="text-lg font-semibold text-gray-50">{title}</Text>
            {description ? <Text className="mt-2 text-sm text-gray-300">{description}</Text> : null}
          </Box>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={onDismiss}
            hitSlop={8}>
            <Box className="rounded-full bg-white/10 px-2.5 py-1">
              <Text className="text-sm font-semibold text-gray-200">✕</Text>
            </Box>
          </Pressable>
        </Box>
        {children ? <Box className="mt-4">{children}</Box> : null}
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
