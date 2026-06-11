import type {GeoJsonFeatureCollection} from '@doors/api/geo/geoJson'
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MaplibreMap,
  type PressEventWithFeatures,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native'
import type {ReactElement} from 'react'
import {useCallback, useMemo} from 'react'
import {type NativeSyntheticEvent, StyleSheet, View} from 'react-native'

import {DEFAULT_CENTER, DEFAULT_ZOOM} from '@/constants/map'
import {useTurfContext} from '@/contexts/TurfContext'
import {useMapViewModel} from '@/hooks/useMapViewModel'
import {useTurfMapNative, useTurfMapNativeLayers} from '@/hooks/useTurfMapNative'
import {
  PEOPLE_CIRCLE_LAYER_ID,
  PEOPLE_COUNT_LAYER_ID,
  PEOPLE_SOURCE_ID,
  peopleCirclePaint,
  peopleCountFilter,
  peopleCountLayout,
  peopleCountPaint,
} from '@/lib/mapPeopleLayer'
import {
  asMapLibreGeoJson,
  TURF_DRAFT_CLOSE_HIT_LAYER_ID,
  TURF_DRAFT_LINE_LAYER_ID,
  TURF_DRAFT_SOURCE_ID,
  TURF_DRAFT_VERTEX_LABEL_LAYER_ID,
  TURF_DRAFT_VERTEX_LAYER_ID,
  TURF_FILL_LAYER_ID,
  TURF_LINE_LAYER_ID,
  TURF_SOURCE_ID,
  turfDraftCloseHitPaint,
  turfDraftLinePaint,
  turfDraftVertexLabelLayout,
  turfDraftVertexLabelPaint,
  turfDraftVertexPaint,
  turfFillPaint,
  turfLinePaint,
} from '@/lib/turfMapLayers'

/**
 * Native iOS/Android map renderer backed by @maplibre/maplibre-react-native v11.
 * Uses built-in pmtiles:// support in phase 1 (simulator dev server) with OpenFreeMap fallback.
 */
export function MapView(): ReactElement {
  const {setViewport, peopleData, peopleEnabled, mapStyle, onBasemapFailure, onPeoplePress} =
    useMapViewModel()
  const {turfActive} = useTurfContext()
  const {turfData, draftData} = useTurfMapNativeLayers()
  const {
    handleMapPress,
    handleMapLongPress,
    handleTurfSourcePress,
    editVertexData,
    draggingVertexIndex,
  } = useTurfMapNative()

  const editVertexFeatures = useMemo((): GeoJsonFeatureCollection => {
    if (editVertexData?.type !== 'Polygon') {
      return {type: 'FeatureCollection', features: []}
    }

    const ring = editVertexData.coordinates[0] ?? []
    const vertices = ring.slice(0, -1)

    return {
      type: 'FeatureCollection',
      features: vertices.map((coordinate, index) => ({
        type: 'Feature' as const,
        properties: {
          vertexIndex: index,
          selected: index === draggingVertexIndex,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: coordinate,
        },
      })),
    }
  }, [draggingVertexIndex, editVertexData])

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
      if (turfActive) {
        return
      }

      const feature = event.nativeEvent.features?.[0]
      if (feature?.properties) {
        onPeoplePress(feature.properties)
      }
    },
    [onPeoplePress, turfActive],
  )

  return (
    <View style={styles.container}>
      <MaplibreMap
        mapStyle={mapStyle}
        onDidFailLoadingMap={onBasemapFailure}
        onRegionDidChange={handleRegionDidChange}
        style={styles.map}
        {...(turfActive
          ? {
              onLongPress: handleMapLongPress,
              onPress: handleMapPress,
            }
          : {})}>
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
        {turfActive ? (
          <>
            <GeoJSONSource
              id={TURF_SOURCE_ID}
              data={asMapLibreGeoJson(turfData)}
              onPress={handleTurfSourcePress}>
              <Layer
                id={TURF_FILL_LAYER_ID}
                source={TURF_SOURCE_ID}
                type="fill"
                paint={turfFillPaint}
              />
              <Layer
                id={TURF_LINE_LAYER_ID}
                source={TURF_SOURCE_ID}
                type="line"
                paint={turfLinePaint}
              />
            </GeoJSONSource>
            <GeoJSONSource id={TURF_DRAFT_SOURCE_ID} data={asMapLibreGeoJson(draftData)}>
              <Layer
                filter={['==', ['geometry-type'], 'LineString']}
                id={TURF_DRAFT_LINE_LAYER_ID}
                source={TURF_DRAFT_SOURCE_ID}
                type="line"
                paint={turfDraftLinePaint}
              />
              <Layer
                filter={['==', ['geometry-type'], 'Point']}
                id={TURF_DRAFT_VERTEX_LAYER_ID}
                source={TURF_DRAFT_SOURCE_ID}
                type="circle"
                paint={turfDraftVertexPaint}
              />
              <Layer
                filter={['all', ['==', ['geometry-type'], 'Point'], ['get', 'isCloseTarget']]}
                id={TURF_DRAFT_CLOSE_HIT_LAYER_ID}
                source={TURF_DRAFT_SOURCE_ID}
                type="circle"
                paint={turfDraftCloseHitPaint}
              />
              <Layer
                filter={['==', ['geometry-type'], 'Point']}
                id={TURF_DRAFT_VERTEX_LABEL_LAYER_ID}
                layout={turfDraftVertexLabelLayout}
                paint={turfDraftVertexLabelPaint}
                source={TURF_DRAFT_SOURCE_ID}
                type="symbol"
              />
            </GeoJSONSource>
            {editVertexFeatures.features.length > 0 ? (
              <GeoJSONSource
                id="doors-turf-edit-vertices"
                data={asMapLibreGeoJson(editVertexFeatures)}>
                <Layer
                  id="doors-turf-edit-vertices-layer"
                  source="doors-turf-edit-vertices"
                  type="circle"
                  paint={{
                    'circle-radius': 8,
                    'circle-color': '#ffffff',
                    'circle-stroke-color': '#F59E0B',
                    'circle-stroke-width': 2,
                  }}
                />
              </GeoJSONSource>
            ) : null}
          </>
        ) : null}
      </MaplibreMap>
    </View>
  )
}

/** Full-screen map container. */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
})
