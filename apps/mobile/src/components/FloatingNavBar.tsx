import type {BottomTabBarProps} from '@react-navigation/bottom-tabs'
import type {ReactElement} from 'react'
import {Platform, Pressable} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {Box} from '@/components/ui/box'
import {Text} from '@/components/ui/text'
import {FLOATING_NAV_MARGIN} from '@/navigation/layout'
import {ROOT_HOME_ROUTE, ROOT_TABS} from '@/navigation/routes'

/**
 * Custom floating tab bar: top-aligned on web, bottom-aligned on native.
 * Pill-shaped dark bar inspired by gluestack docs header styling.
 */
export function FloatingNavBar({state, navigation}: BottomTabBarProps): ReactElement {
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === 'web'

  // Position the bar below/above safe-area insets.
  const positionStyle = isWeb
    ? {top: insets.top + FLOATING_NAV_MARGIN}
    : {bottom: insets.bottom + FLOATING_NAV_MARGIN}

  const onBrandPress = (): void => {
    navigation.navigate(ROOT_HOME_ROUTE)
  }

  return (
    <Box className="absolute inset-x-4 z-50" style={positionStyle} pointerEvents="box-none">
      <Box className="flex-row items-center gap-3 rounded-full border border-white/10 bg-gray-900/90 px-4 py-2 shadow-lg">
        {isWeb ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to map home"
            onPress={onBrandPress}>
            <Text className="shrink-0 text-sm font-bold text-gray-50">Doors</Text>
          </Pressable>
        ) : null}
        <Box
          className={`min-w-0 flex-1 flex-row items-center gap-1 ${isWeb ? 'justify-end' : 'justify-around'}`}>
          {state.routes.map((route, index) => {
            const tabMeta = ROOT_TABS.find(tab => tab.name === route.name)
            const label = tabMeta?.label ?? route.name
            const isFocused = state.index === index

            const onPress = (): void => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              })

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name)
              }
            }

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? {selected: true} : {}}
                accessibilityLabel={label}
                onPress={onPress}>
                <Box className={`rounded-full px-4 py-2 ${isFocused ? 'bg-white/10' : ''}`}>
                  <Text
                    className={`text-sm font-medium ${isFocused ? 'text-gray-50' : 'text-gray-400'}`}>
                    {label}
                  </Text>
                </Box>
              </Pressable>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
