import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import type {MapViewport} from '@doors/api/schemas'
import type {ReactElement} from 'react'
import {useCallback, useEffect, useRef, useState} from 'react'
import {StyleSheet, View} from 'react-native'

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
import {registerPmtilesProtocol} from '../lib/registerPmtilesProtocol'

/** Paint definition for people dots and cluster bubbles. */
const peopleLayerPaint: maplibregl.CircleLayerSpecification['paint'] = {
  'circle-radius': [
    'case',
    ['==', ['get', 'cluster'], true],
    ['interpolate', ['linear'], ['get', 'count'], 1, 12, 100, PEOPLE_CLUSTER_MAX_RADIUS],
    PEOPLE_DOT_RADIUS,
  ],
  'circle-color': [
    'case',
    ['==', ['get', 'cluster'], true],
    PEOPLE_CLUSTER_COLOR,
    PEOPLE_DOT_COLOR,
  ],
  'circle-stroke-width': 1,
  'circle-stroke-color': '#ffffff',
}

/**
 * Web map renderer backed by maplibre-gl v5.
 * Loads local PMTiles when available and falls back to OpenFreeMap on failure.
 */
export function MapView(): ReactElement {
  const appearance = useMapAppearance()
  const appearanceRef = useRef(appearance)
  const previousAppearanceRef = useRef<string | null>(null)
  const hostRef = useRef<View>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const fallbackUsedRef = useRef(false)
  const [viewport, setViewport] = useState<MapViewport | null>(null)
  const apiHealth = useApiHealth()
  const peopleEnabled = apiHealth === 'ok'
  const {data: peopleData} = useMapPeople(viewport, peopleEnabled)

  // Keep the error handler aligned with the latest system appearance.
  appearanceRef.current = appearance

  const syncViewport = useCallback((map: maplibregl.Map): void => {
    const bounds = map.getBounds()
    const west = bounds.getWest()
    const south = bounds.getSouth()
    const east = bounds.getEast()
    const north = bounds.getNorth()
    const zoom = map.getZoom()

    // Store the latest viewport for debounced people fetching.
    setViewport({west, south, east, north, zoom})
  }, [])

  const ensurePeopleLayer = useCallback(
    (map: maplibregl.Map): void => {
      const existingSource = map.getSource(PEOPLE_SOURCE_ID)

      // Create the GeoJSON source and circle layer on first use.
      if (!existingSource) {
        map.addSource(PEOPLE_SOURCE_ID, {
          type: 'geojson',
          data: peopleData,
        })
        map.addLayer({
          id: PEOPLE_CIRCLE_LAYER_ID,
          type: 'circle',
          source: PEOPLE_SOURCE_ID,
          paint: peopleLayerPaint,
        } as maplibregl.AddLayerObject)
        return
      }

      // Update an existing source when new people data arrives.
      const source = existingSource as maplibregl.GeoJSONSource
      source.setData(peopleData)
    },
    [peopleData],
  )

  const ensurePeopleLayerRef = useRef(ensurePeopleLayer)
  ensurePeopleLayerRef.current = ensurePeopleLayer

  useEffect(() => {
    // RN-web exposes the underlying DOM element through the View ref.
    const hostElement = hostRef.current as unknown as HTMLDivElement | null
    if (!hostElement || mapRef.current) {
      return
    }

    // Enable pmtiles:// sources before constructing the map instance.
    registerPmtilesProtocol()

    // Build a local style that points at the dev-server PMTiles archive.
    const basemapStyle = buildBasemapStyle(getBasemapPmtilesUrl(), appearanceRef.current)

    // Create the MapLibre instance against the host DOM node.
    const map = new maplibregl.Map({
      container: hostElement,
      style: basemapStyle,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    })

    mapRef.current = map

    // Fall back to the remote OpenFreeMap style when local tiles or style assets fail.
    map.on('error', () => {
      if (fallbackUsedRef.current) {
        return
      }

      fallbackUsedRef.current = true
      map.setStyle(getRemoteFallbackStyleUrl(appearanceRef.current))
    })

    // Resize once tiles load in case layout settled after first paint.
    map.once('load', () => {
      map.resize()
      syncViewport(map)
      previousAppearanceRef.current = appearanceRef.current
      ensurePeopleLayerRef.current(map)
    })

    // Refresh viewport state whenever the user finishes panning or zooming.
    map.on('moveend', () => {
      syncViewport(map)
    })

    // Log person or cluster metadata when a dot is clicked.
    map.on('click', event => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [PEOPLE_CIRCLE_LAYER_ID],
      })
      const feature = features[0]
      if (feature?.properties) {
        logMapPersonFeature(feature.properties)
      }
    })

    map.on('mouseenter', PEOPLE_CIRCLE_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', PEOPLE_CIRCLE_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
    })

    return (): void => {
      map.remove()
      mapRef.current = null
    }
  }, [syncViewport])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) {
      return
    }

    // Only reload the basemap when appearance actually changes.
    if (previousAppearanceRef.current === appearance) {
      return
    }

    const hadPreviousAppearance = previousAppearanceRef.current !== null
    previousAppearanceRef.current = appearance

    // Record the initial appearance without reloading the style we just created.
    if (!hadPreviousAppearance) {
      return
    }

    // Swap between light and dark palettes when the system appearance changes.
    const nextStyle = fallbackUsedRef.current
      ? getRemoteFallbackStyleUrl(appearance)
      : buildBasemapStyle(getBasemapPmtilesUrl(), appearance)
    map.setStyle(nextStyle)

    // Re-sync viewport and people layer after the basemap style reloads.
    map.once('load', () => {
      syncViewport(map)
      ensurePeopleLayerRef.current(map)
    })
  }, [appearance, syncViewport])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !peopleEnabled) {
      return
    }

    // Push the latest people GeoJSON into the map layer.
    ensurePeopleLayer(map)
  }, [ensurePeopleLayer, peopleEnabled])

  return <View ref={hostRef} style={styles.map} />
}

/** Layout for a map that fills all space offered by its parent. */
const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
})
