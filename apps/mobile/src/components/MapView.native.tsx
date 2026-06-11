import type {MapViewport} from '@doors/api/schemas'
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MaplibreMap,
  type PressEventWithFeatures,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native'
import type {StyleSpecification} from 'maplibre-gl'
import type {ReactElement} from 'react'
import {useCallback, useMemo, useState} from 'react'
import {type NativeSyntheticEvent, StyleSheet, View} from 'react-native'

import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  getBasemapPmtilesUrl,
  getRemoteFallbackStyleUrl,
} from '../constants/map'
import {useApiHealth} from '../hooks/useApiHealth'
import {useMapAppearance} from '../hooks/useMapAppearance'
import {useMapPeople} from '../hooks/useMapPeople'
import {buildBasemapStyle} from '../lib/basemapStyle'
import {logMapPersonFeature} from '../lib/logMapPersonFeature'
import {
  PEOPLE_CIRCLE_LAYER_ID,
  PEOPLE_CLUSTER_COLOR,
  PEOPLE_CLUSTER_MAX_RADIUS,
  PEOPLE_DOT_COLOR,
  PEOPLE_DOT_RADIUS,
  PEOPLE_SOURCE_ID,
} from '../lib/mapPeopleLayer'

/**
 * Native iOS/Android map renderer backed by @maplibre/maplibre-react-native v11.
 * Uses built-in pmtiles:// support in phase 1 (simulator dev server) with OpenFreeMap fallback.
 */
export function MapView(): ReactElement {
  const appearance = useMapAppearance()
  const [fallbackUsed, setFallbackUsed] = useState(false)
  const [viewport, setViewport] = useState<MapViewport | null>(null)
  const apiHealth = useApiHealth()
  const peopleEnabled = apiHealth === 'ok'
  const {data: peopleData} = useMapPeople(viewport, peopleEnabled)

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

  const handleRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>): void => {
      const {bounds, zoom} = event.nativeEvent
      const [west, south, east, north] = bounds

      // Store the latest viewport for debounced people fetching.
      setViewport({west, south, east, north, zoom})
    },
    [],
  )

  const handlePeoplePress = useCallback(
    (event: NativeSyntheticEvent<PressEventWithFeatures>): void => {
      const feature = event.nativeEvent.features?.[0]
      if (feature?.properties) {
        logMapPersonFeature(feature.properties)
      }
    },
    [],
  )

  return (
    <View style={styles.container}>
      <MaplibreMap
        mapStyle={mapStyle}
        onDidFailLoadingMap={handleMapLoadFailure}
        onRegionDidChange={handleRegionDidChange}
        style={styles.map}>
        <Camera
          initialViewState={{
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
          }}
        />
        {peopleEnabled ? (
          <GeoJSONSource id={PEOPLE_SOURCE_ID} data={peopleData} onPress={handlePeoplePress}>
            <Layer
              id={PEOPLE_CIRCLE_LAYER_ID}
              source={PEOPLE_SOURCE_ID}
              type="circle"
              paint={{
                'circle-color': [
                  'case',
                  ['==', ['get', 'cluster'], true],
                  PEOPLE_CLUSTER_COLOR,
                  PEOPLE_DOT_COLOR,
                ],
                'circle-radius': [
                  'case',
                  ['==', ['get', 'cluster'], true],
                  [
                    'interpolate',
                    ['linear'],
                    ['get', 'count'],
                    1,
                    12,
                    100,
                    PEOPLE_CLUSTER_MAX_RADIUS,
                  ],
                  PEOPLE_DOT_RADIUS,
                ],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1,
              }}
            />
          </GeoJSONSource>
        ) : null}
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
