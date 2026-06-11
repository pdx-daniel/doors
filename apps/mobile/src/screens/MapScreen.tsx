import {StyleSheet, View} from 'react-native';
import {MapView} from '../components/MapView';

/**
 * Full-screen screen that hosts the platform-specific map component.
 */
export function MapScreen() {
  return (
    <View style={styles.container}>
      <MapView />
    </View>
  );
}

/** Fills remaining space below the optional status banner. */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
});
