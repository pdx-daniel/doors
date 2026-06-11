import type {ReactElement} from 'react'
import {StyleSheet, Text, View} from 'react-native'

import {MapView} from '../components/MapView'
import {MAP_ATTRIBUTION} from '../constants/map'
import {useMapAppearance} from '../hooks/useMapAppearance'

/**
 * Full-screen screen that hosts the platform-specific map component.
 * Shows required OpenMapTiles / OSM attribution over the map.
 */
export function MapScreen(): ReactElement {
  const appearance = useMapAppearance()
  const isDark = appearance === 'dark'

  return (
    <View style={styles.container}>
      <MapView />
      <View
        pointerEvents="none"
        style={[styles.attribution, isDark ? styles.attributionDark : styles.attributionLight]}>
        <Text
          style={[
            styles.attributionText,
            isDark ? styles.attributionTextDark : styles.attributionTextLight,
          ]}>
          {MAP_ATTRIBUTION}
        </Text>
      </View>
    </View>
  )
}

/** Fills remaining space below the optional status banner. */
const styles = StyleSheet.create({
  attribution: {
    bottom: 8,
    left: 8,
    maxWidth: '80%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
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
})
