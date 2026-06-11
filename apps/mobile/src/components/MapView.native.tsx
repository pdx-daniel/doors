import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MaplibreMap,
  type PressEventWithFeatures,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native'
import type {ReactElement} from 'react'
import {useCallback} from 'react'
import {type NativeSyntheticEvent, StyleSheet, View} from 'react-native'

import {DEFAULT_CENTER, DEFAULT_ZOOM} from '@/constants/map'
import {useMapViewModel} from '@/hooks/useMapViewModel'
import {
  PEOPLE_CIRCLE_LAYER_ID,
  PEOPLE_COUNT_LAYER_ID,
  PEOPLE_SOURCE_ID,
  peopleCirclePaint,
  peopleCountFilter,
  peopleCountLayout,
  peopleCountPaint,
} from '@/lib/mapPeopleLayer'

/**
 * Native iOS/Android map renderer backed by @maplibre/maplibre-react-native v11.
 * Uses built-in pmtiles:// support in phase 1 (simulator dev server) with OpenFreeMap fallback.
 */
export function MapView(): ReactElement {
  const {setViewport, peopleData, peopleEnabled, mapStyle, onBasemapFailure, onPeoplePress} =
    useMapViewModel()

  const handleRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>): void => {
      const {bounds, zoom} = event.nativeEvent
      const [west, south, east, north] = bounds

      setViewport({west, south, east, north, zoom})
    },
    [setViewport],
  )

  const handlePeoplePress = useCallback(
    (event: NativeSyntheticEvent<PressEventWithFeatures>): void => {
      const feature = event.nativeEvent.features?.[0]
      if (feature?.properties) {
        onPeoplePress(feature.properties)
      }
    },
    [onPeoplePress],
  )

  return (
    <View style={styles.container}>
      <MaplibreMap
        mapStyle={mapStyle}
        onDidFailLoadingMap={onBasemapFailure}
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
              paint={peopleCirclePaint}
            />
            <Layer
              filter={peopleCountFilter}
              id={PEOPLE_COUNT_LAYER_ID}
              layout={peopleCountLayout}
              paint={peopleCountPaint}
              source={PEOPLE_SOURCE_ID}
              type="symbol"
            />
          </GeoJSONSource>
        ) : null}
      </MaplibreMap>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
})
