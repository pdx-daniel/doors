import {Camera, Map as MaplibreMap} from '@maplibre/maplibre-react-native'
import type {StyleSpecification} from 'maplibre-gl'
import type {ReactElement} from 'react'
import {useCallback, useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  getBasemapPmtilesUrl,
  getRemoteFallbackStyleUrl,
} from '../constants/map'
import {useMapAppearance} from '../hooks/useMapAppearance'
import {buildBasemapStyle} from '../lib/basemapStyle'

/**
 * Native iOS/Android map renderer backed by @maplibre/maplibre-react-native v11.
 * Uses built-in pmtiles:// support in phase 1 (simulator dev server) with OpenFreeMap fallback.
 */
export function MapView(): ReactElement {
  const appearance = useMapAppearance()
  const [fallbackUsed, setFallbackUsed] = useState(false)

  const mapStyle = useMemo((): string | StyleSpecification => {
    if (fallbackUsed) {
      return getRemoteFallbackStyleUrl(appearance)
    }

    return buildBasemapStyle(getBasemapPmtilesUrl(), appearance)
  }, [appearance, fallbackUsed])

  const handleMapLoadFailure = useCallback((): void => {
    // Swap to the remote OpenFreeMap style once when local PMTiles are unreachable.
    if (fallbackUsed) {
      return
    }

    setFallbackUsed(true)
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
