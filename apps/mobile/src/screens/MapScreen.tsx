import type {ReactElement} from 'react'
import {StyleSheet, View} from 'react-native'

/**
 * Transparent route shown when the Map tab is active.
 * The map itself lives in AppShell and stays mounted underneath.
 */
export function MapScreen(): ReactElement {
  return <View style={styles.container} pointerEvents="box-none" />
}

/** Full-screen pass-through so map interactions work unobstructed. */
const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1,
  },
})
