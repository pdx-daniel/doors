import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import type {ReactElement} from 'react'

import {FloatingNavBar} from '@/components/FloatingNavBar'
import {FloatingPanelOverlay} from '@/components/FloatingPanelOverlay'
import type {RootTabParamList} from '@/navigation/linking'
import {MapScreen} from '@/screens/MapScreen'
import {SettingsScreen} from '@/screens/SettingsScreen'

const Tab = createBottomTabNavigator<RootTabParamList>()

/**
 * Root bottom-tab navigator with transparent scenes over the persistent map.
 * Map and overlay tabs sit above the map; Settings is a full-page route.
 */
export function RootNavigator(): ReactElement {
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
      tabBar={(props): ReactElement => <FloatingNavBar {...props} />}>
      <Tab.Screen name="Map" component={MapScreen} />
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
