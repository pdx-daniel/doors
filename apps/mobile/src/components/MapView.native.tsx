import {Camera, Map as MapLibreMap} from '@maplibre/maplibre-react-native'
import type {ReactElement} from 'react'
import {StyleSheet, View} from 'react-native'

import {DEFAULT_CENTER, DEFAULT_ZOOM, LIBERTY_STYLE_URL} from '../constants/map'

/**
 * Native iOS/Android map renderer backed by @maplibre/maplibre-react-native v11.
 */
export function MapView(): ReactElement {
  return (
    <View style={styles.container}>
      <MapLibreMap mapStyle={LIBERTY_STYLE_URL} style={styles.map}>
        <Camera
          initialViewState={{
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
          }}
        />
      </MapLibreMap>
    </View>
  )
}

/** Layout styles for a map that expands to fill its parent. */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
})
