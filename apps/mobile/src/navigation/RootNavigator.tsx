import type {BottomTabBarProps} from '@react-navigation/bottom-tabs'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import type {ReactElement} from 'react'
import {Platform} from 'react-native'

import {FloatingPanelOverlay} from '@/components/FloatingPanelOverlay'
import {TabBarBridge} from '@/components/TabBarBridge'
import type {RootTabParamList} from '@/navigation/linking'
import {MapScreen} from '@/screens/MapScreen'
import {SettingsScreen} from '@/screens/SettingsScreen'
import {TurfScreen} from '@/screens/TurfScreen'

const Tab = createBottomTabNavigator<RootTabParamList>()

type RootNavigatorProps = {
  onTabBarChange: (props: BottomTabBarProps) => void
}

/**
 * Root bottom-tab navigator with transparent scenes over the persistent map.
 * Map and overlay tabs sit above the map; Settings is a full-page route.
 */
export function RootNavigator({onTabBarChange}: RootNavigatorProps): ReactElement {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        sceneStyle: {backgroundColor: 'transparent'},
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
      tabBar={(props): ReactElement => <TabBarBridge props={props} onChange={onTabBarChange} />}>
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          sceneStyle: Platform.select({
            web: {backgroundColor: 'transparent', pointerEvents: 'none'},
            default: {backgroundColor: 'transparent'},
          }),
        }}
      />
      <Tab.Screen
        name="Turf"
        component={TurfScreen}
        options={{
          sceneStyle: Platform.select({
            web: {backgroundColor: 'transparent', pointerEvents: 'box-none'},
            default: {backgroundColor: 'transparent'},
          }),
        }}
      />
      <Tab.Screen name="Dummy1">
        {(): ReactElement => (
          <FloatingPanelOverlay
            title="Dummy 1"
            description="Placeholder panel — the map stays mounted underneath."
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}
