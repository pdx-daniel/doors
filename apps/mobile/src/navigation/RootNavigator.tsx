import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import type {ReactElement} from 'react'

import {FloatingNavBar} from '@/components/FloatingNavBar'
import type {RootTabParamList} from '@/navigation/linking'
import {DummyScreen} from '@/screens/DummyScreen'
import {MapScreen} from '@/screens/MapScreen'

const Tab = createBottomTabNavigator<RootTabParamList>()

/**
 * Root bottom-tab navigator with transparent scenes over the persistent map.
 * Uses a custom floating tab bar instead of the default platform chrome.
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
          <DummyScreen
            title="Dummy 1"
            description="Placeholder panel — the map stays mounted underneath."
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Dummy2">
        {(): ReactElement => (
          <DummyScreen
            title="Dummy 2"
            description="Another placeholder route for future features."
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  )
}
