import type {ReactElement} from 'react'
import {StyleSheet, Text, View} from 'react-native'

import {MapView} from '../components/MapView'
import {MAP_ATTRIBUTION} from '../constants/map'

/**
 * Full-screen screen that hosts the platform-specific map component.
 * Shows required OpenMapTiles / OSM attribution over the map.
 */
export function MapScreen(): ReactElement {
  return (
    <View style={styles.container}>
      <MapView />
      <View pointerEvents="none" style={styles.attribution}>
        <Text style={styles.attributionText}>{MAP_ATTRIBUTION}</Text>
      </View>
    </View>
  )
}

/** Fills remaining space below the optional status banner. */
const styles = StyleSheet.create({
  attribution: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    bottom: 8,
    left: 8,
    maxWidth: '80%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
  },
  attributionText: {
    color: '#374151',
    fontSize: 10,
    lineHeight: 14,
  },
  container: {
    flex: 1,
    minHeight: 0,
  },
})
