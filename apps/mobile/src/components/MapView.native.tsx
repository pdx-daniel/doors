import {Camera, Map as MaplibreMap} from '@maplibre/maplibre-react-native'
import type {StyleSpecification} from 'maplibre-gl'
import type {ReactElement} from 'react'
import {useCallback, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  getBasemapPmtilesUrl,
  LIBERTY_STYLE_URL,
} from '../constants/map'
import {buildBasemapStyle} from '../lib/basemapStyle'

/**
 * Native iOS/Android map renderer backed by @maplibre/maplibre-react-native v11.
 * Uses built-in pmtiles:// support in phase 1 (simulator dev server) with OpenFreeMap fallback.
 */
export function MapView(): ReactElement {
  const [mapStyle, setMapStyle] = useState<string | StyleSpecification>(() =>
    buildBasemapStyle(getBasemapPmtilesUrl()),
  )
  const [fallbackUsed, setFallbackUsed] = useState(false)

  const handleMapLoadFailure = useCallback((): void => {
    // Swap to the remote Liberty style once when local PMTiles are unreachable.
    if (fallbackUsed) {
      return
    }

    setFallbackUsed(true)
    setMapStyle(LIBERTY_STYLE_URL)
  }, [fallbackUsed])

  return (
    <View style={styles.container}>
      <MaplibreMap
        mapStyle={mapStyle}
        onDidFailLoadingMap={handleMapLoadFailure}
        style={styles.map}>
        <Camera
          initialViewState={{
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
          }}
        />
      </MaplibreMap>
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
