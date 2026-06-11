import type {ReactElement} from 'react'
import {StyleSheet, View} from 'react-native'

/**
 * Transparent route shown when the Turf tab is active.
 * TurfSubToolbar is rendered in AppShell above the interactive map layer.
 */
export function TurfScreen(): ReactElement {
  return <View pointerEvents="none" style={styles.container} />
}

/** Full-screen pass-through so map interactions work unobstructed. */
const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1,
  },
})
