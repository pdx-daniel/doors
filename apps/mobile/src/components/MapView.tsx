import type {ReactElement} from 'react'
import {Text, View} from 'react-native'

/**
 * Fallback map placeholder for platforms without a dedicated implementation.
 */
export function MapView(): ReactElement {
  return (
    <View>
      <Text>Map is not available on this platform.</Text>
    </View>
  )
}
