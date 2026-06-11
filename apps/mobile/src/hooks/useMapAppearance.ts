import {useColorScheme} from 'react-native'

import {type MapAppearance, resolveMapAppearance} from '../constants/map'

/**
 * Returns the map appearance (`light` or `dark`) from the device or browser color scheme.
 */
export function useMapAppearance(): MapAppearance {
  const colorScheme = useColorScheme()

  // Normalize RN's nullable color scheme into a concrete map variant.
  return resolveMapAppearance(colorScheme)
}
