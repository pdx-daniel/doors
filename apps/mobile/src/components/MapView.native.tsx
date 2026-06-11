import {Camera, Map} from '@maplibre/maplibre-react-native';
import {StyleSheet, View} from 'react-native';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  LIBERTY_STYLE_URL,
} from '../constants/map';

/**
 * Native iOS/Android map renderer backed by @maplibre/maplibre-react-native v11.
 */
export function MapView() {
  return (
    <View style={styles.container}>
      <Map mapStyle={LIBERTY_STYLE_URL} style={styles.map}>
        <Camera
          initialViewState={{
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
          }}
        />
      </Map>
    </View>
  );
}

/** Layout styles for a map that expands to fill its parent. */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
